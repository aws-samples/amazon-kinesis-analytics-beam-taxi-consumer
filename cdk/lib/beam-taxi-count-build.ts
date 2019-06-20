import cdk = require('@aws-cdk/cdk');
import s3 = require('@aws-cdk/aws-s3');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import { BuildSpec } from '@aws-cdk/aws-codebuild';
import { CfnParameter, SecretValue } from '@aws-cdk/cdk';

export interface BeamBuildPipelineProps {
  bucket: s3.Bucket,
  region: string,
  accountId: string
}

export class BeamBuildPipeline extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: BeamBuildPipelineProps) {
    super(scope, id);

    const oauthToken = SecretValue.cfnParameter(
      new CfnParameter(this, 'GithubOauthToken', {
        type: 'String',
        noEcho: true,
        description: `Create a token with 'repo' and 'admin:repo_hook' permissions here https://github.com/settings/tokens`
      })
    );
    
    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'SourceAction',
      repo: 'amazon-kinesis-analytics-beam-taxi-consumer',
      owner: 'aws-samples',
      oauthToken: oauthToken,
      branch: 'master',
      output: sourceOutput,
    });

    const project = new codebuild.Project(this, 'MyProject', {
//      source: new codebuild.CodePipelineSource(),
//      artifacts: new codebuild.CodePipelineBuildArtifacts(),
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
          actions: [copyAction]
        }
      ],
    });

    new cdk.CfnOutput(this, 'BeamTaxiCountCopyCommand', { value: `aws s3 cp --recursive --exclude '*' --include 'beam-taxi-count-*.jar' 's3://${props.bucket.bucketName}/target/' .` });
  }
}