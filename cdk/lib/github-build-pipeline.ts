import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import cfn = require('@aws-cdk/aws-cloudformation');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import { BuildSpec } from '@aws-cdk/aws-codebuild';
import lambda = require('@aws-cdk/aws-lambda');
import * as fs from 'fs';
import { Duration } from '@aws-cdk/core';

export interface GithubBuildPipelineProps {
  bucket: s3.Bucket,
  region: string,
  accountId: string,
  oauthToken: cdk.SecretValue
  repo: string,
  artifactPrefix: string
}

export class GithubBuildPipeline extends cdk.Construct {
  buildSuccessWaitCondition: cfn.CfnWaitCondition;

  constructor(scope: cdk.Construct, id: string, props: GithubBuildPipelineProps) {
    super(scope, id);
    
    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'SourceAction',
      repo: props.repo,
      owner: 'aws-samples',
      oauthToken: props.oauthToken,
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
            `target/${props.artifactPrefix}-*.jar`
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
      handle: waitHandle.ref,
      timeout: '300'
    });

    const lambdaSource = fs.readFileSync('lambda/notify-build-success.py').toString();

    const notifyLambda =  new lambda.Function(this, 'NotifyLambda', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.inline(lambdaSource),
      timeout: Duration.seconds(10),
      handler: 'index.handler',
      environment: {
        waitHandleUrl: waitHandle.ref
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

    const cfnId = props.artifactPrefix.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

    new cdk.CfnOutput(this, `${cfnId}CopyCommand`, { value: `aws s3 cp --recursive --exclude '*' --include '${props.artifactPrefix}-*.jar' 's3://${props.bucket.bucketName}/target/' .` });
  }
}