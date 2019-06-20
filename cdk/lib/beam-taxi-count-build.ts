import cdk = require('@aws-cdk/cdk');
import s3 = require('@aws-cdk/aws-s3');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codecommit = require('@aws-cdk/aws-codecommit');
import codebuild = require('@aws-cdk/aws-codebuild');

export interface BeamBuildPipelineProps {
  bucket: s3.Bucket,
  region: string,
  accountId: string
}

export class BeamBuildPipeline extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: BeamBuildPipelineProps) {
    super(scope, id);

    const repo = codecommit.Repository.fromRepositoryArn(this, 'CodeCommitRepository', `arn:aws:codecommit:${props.region}:${props.accountId}:AwsSaBeamTaxiCount`);
    
    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'SourceAction',
      repository: repo,
      branch: 'mainline',
      output: sourceOutput
    });


    const project = new codebuild.Project(this, 'MyProject', {
      source: new codebuild.CodePipelineSource(),
      artifacts: new codebuild.CodePipelineBuildArtifacts(),
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_OPEN_JDK_11
      },
      buildSpec: {
        version: '0.2',
        phases: {
          build: {
            commands: [
              'cd beam-taxi-count-* || :',
              'mvn clean package -B'
            ]
          }
        },
        artifacts: {
          files: [
            'target/beam-taxi-count-*.jar',
            'beam-taxi-count-*/target/beam-taxi-count-*.jar'
          ],
          discard: true
        }
      }
    });


    const buildOutput = new codepipeline.Artifact();

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildAction',
      project,
      input: sourceOutput,
      output: buildOutput
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
          name: 'Source',
          actions: [sourceAction],
        },
        {
          name: 'Build',
          actions: [buildAction],
        },
        {
          name: 'Copy',
          actions: [copyAction]
        }
      ],
    });

    new cdk.CfnOutput(this, 'BeamTaxiCountCopyCommand', { value: `aws s3 cp --recursive --exclude '*' --include 'beam-taxi-count-*.jar' 's3://${props.bucket.bucketName}/target/' .` });
  }
}