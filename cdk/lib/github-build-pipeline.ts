import fs = require('fs');
import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import cfn = require('@aws-cdk/aws-cloudformation');
import lambda = require('@aws-cdk/aws-lambda');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import { BuildSpec } from '@aws-cdk/aws-codebuild';
import { Duration } from '@aws-cdk/core';
import { CustomResourceProvider } from '@aws-cdk/aws-cloudformation';

export interface GithubBuildPipelineProps {
  url: string,
  bucket: s3.Bucket,
  extract: boolean,
  files?: string[],
  objectKey?: string,
  buildspec?: codebuild.BuildSpec,
  sourceAction?: codepipeline_actions.S3SourceAction
}


export class GithubBuildPipeline extends cdk.Construct {
  buildSuccessWaitCondition: cfn.CfnWaitCondition;

  constructor(scope: cdk.Construct, id: string, props: GithubBuildPipelineProps) {
    super(scope, id);

    const match = props.url.match(/https:\/\/github.com\/[^\/]+\/([^\/]+)\/archive\/([^\/]+)\.zip/);

    if (! match) {
      throw Error(`Expecting valid GitHub archive url, found: ${props.url}`);
    }

    const artifact = match[1];
    const directory = match.slice(1).join('-');
    const key = `sources/${directory}.zip`;

    const lambdaSource = fs.readFileSync('lambda/build-pipeline-helper.py').toString();

    const downloadLambda =  new lambda.Function(this, 'DownloadLambda', {
      runtime: lambda.Runtime.PYTHON_3_7,
      timeout: Duration.seconds(30),
      code: lambda.Code.inline(lambdaSource),
      handler: 'index.download_sources',
      environment: {
        url: props.url,
        bucket: props.bucket.bucketName,
        key: key
      }
    });

    props.bucket.grantPut(downloadLambda);

    new cfn.CustomResource(this, 'DownloadLambdaResource', {
      provider: CustomResourceProvider.lambda(downloadLambda)
    });


    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.S3SourceAction({
      actionName: 'SourceAction',
      bucket: props.bucket,
      bucketKey: key,
      output: sourceOutput
    });


    const defaultBuildspec = BuildSpec.fromObject({
      version: '0.2',
      phases: {
        build: {
          commands: [
            `cd ${directory}`,
            'mvn clean package -B'
          ]
        }
      },
      artifacts: {
        files: [
          `target/${artifact}-*.jar`
        ].concat(props.files ? props.files : []),
        'discard-paths': false,
        'base-directory': directory
      }
    });

    const project = new codebuild.PipelineProject(this, 'CodebuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_OPEN_JDK_11
      },
      buildSpec: props.buildspec ? props.buildspec : defaultBuildspec
    });


    const buildOutput = new codepipeline.Artifact();

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildAction',
      project,
      input: sourceOutput,
      extraInputs: props.sourceAction ? props.sourceAction.actionProperties.outputs : undefined,
      outputs: [buildOutput]
    });

    const copyAction = new codepipeline_actions.S3DeployAction({
      actionName: 'CopyAction',
      bucket: props.bucket,
      input: buildOutput,
      extract: props.extract,
      objectKey: props.objectKey
    });
    
    const waitHandle = new cfn.CfnWaitConditionHandle(this, 'WaitHandle');

    this.buildSuccessWaitCondition = new cfn.CfnWaitCondition(this, 'WaitCondition', {
      count: 1,
      handle: waitHandle.ref,
      timeout: Duration.minutes(20).toSeconds().toString()
    });


    const notifyLambda =  new lambda.Function(this, 'NotifyLambda', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.inline(lambdaSource),
      timeout: Duration.seconds(10),
      handler: 'index.notify_build_success',
      environment: {
        waitHandleUrl: waitHandle.ref,
      }
    });

    const notifyAction = new codepipeline_actions.LambdaInvokeAction({
      actionName: 'InvokeAction',
      lambda: notifyLambda,
      runOrder: 2
    });


    new codepipeline.Pipeline(this, 'CodePipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: props.sourceAction ? [sourceAction, props.sourceAction] : [sourceAction]
        },
        {
          stageName: 'Build',
          actions: [buildAction]
        },
        {
          stageName: 'Copy',
          actions: [copyAction, notifyAction]
        }
      ],
      artifactBucket: props.bucket
    });


    const cfnId = artifact.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

    new cdk.CfnOutput(this, `${cfnId}CopyCommand`, { value: `aws s3 cp --recursive --exclude '*' --include '${artifact}-*.jar' 's3://${props.bucket.bucketName}/target/' .` });
  }
}