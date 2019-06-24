import cdk = require('@aws-cdk/cdk');
import s3 = require('@aws-cdk/aws-s3');
import cfn = require('@aws-cdk/aws-cloudformation');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import { BuildSpec } from '@aws-cdk/aws-codebuild';
import lambda = require('@aws-cdk/aws-lambda');
import { SecretValue, CfnParameter } from '@aws-cdk/cdk';
import * as fs from 'fs';

export interface BeamBuildPipelineProps {
  bucket: s3.Bucket,
  region: string,
  accountId: string
}

export class BeamBuildPipeline extends cdk.Construct {
  buildSuccessWaitCondition: cfn.CfnWaitCondition;

  constructor(scope: cdk.Construct, id: string, props: BeamBuildPipelineProps) {
    super(scope, id);

    const oauthToken = SecretValue.cfnParameter(
      new CfnParameter(this, 'GithubOauthToken', {
        type: 'String',
        noEcho: true,
        description: `Create a token with 'repo' and 'admin:repo_hook' permissions here https://github.com/settings/tokens`
      })
    );

    /*
    const secretId = this.node.tryGetContext('secretId');

    const oauthToken = SecretValue.secretsManager(secretId, {
      jsonField: 'api-key'
    });
    */
    
    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'SourceAction',
      repo: 'amazon-kinesis-analytics-beam-taxi-consumer',
      owner: 'aws-samples',
      oauthToken: oauthToken,
      branch: 'master',
      output: sourceOutput
    });

    const project = new codebuild.Project(this, 'MyProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_OPEN_JDK_11
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'mvn clean package -B'
            ]
          }
        },
        artifacts: {
          files: [
            'target/beam-taxi-count-*.jar'
          ],
          discard: true
        }
      })
    });


    const buildOutput = new codepipeline.Artifact();

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildAction',
      project,
      input: sourceOutput,
      outputs: [buildOutput]
    });

    const copyAction = new codepipeline_actions.S3DeployAction({
      actionName: 'CopyAction',
      bucket: props.bucket,
      input: buildOutput,
      extract: true
    });

    
    const waitHandle = new cfn.CfnWaitConditionHandle(this, 'WaitHandle');

    this.buildSuccessWaitCondition = new cfn.CfnWaitCondition(this, 'WaitCondition', {
      count: 1,
      handle: waitHandle.refAsString,
      timeout: '300'
    });

    const lambdaSource = fs.readFileSync('lambda/notify-build-success.py').toString();

    const notifyLambda =  new lambda.Function(this, 'NotifyLambda', {
      runtime: lambda.Runtime.Python37,
      code: lambda.Code.inline(lambdaSource),
      timeout: 10,
      handler: 'index.handler',
      environment: {
        waitHandleUrl: waitHandle.refAsString
      }
    });

    const notifyAction = new codepipeline_actions.LambdaInvokeAction({
      actionName: 'InvokeAction',
      lambda: notifyLambda,
      runOrder: 2
    });


    new codepipeline.Pipeline(this, 'MyPipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Copy',
          actions: [copyAction, notifyAction]
        }
      ],
      artifactBucket: props.bucket
    });

    new cdk.CfnOutput(this, 'BeamTaxiCountCopyCommand', { value: `aws s3 cp --recursive --exclude '*' --include 'beam-taxi-count-*.jar' 's3://${props.bucket.bucketName}/target/' .` });
  }
}