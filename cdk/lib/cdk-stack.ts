import fs = require('fs');
import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import ec2 = require('@aws-cdk/aws-ec2');
import kds = require('@aws-cdk/aws-kinesis');
import lambda = require('@aws-cdk/aws-lambda');
import { KinesisReplay } from './amazon-kinesis-replay';
import { GithubBuildPipeline } from './github-build-pipeline';
import { EmrInfrastructure } from './emr-infrastructure';
import { KinesisAnalyticsJava } from './kinesis-analytics-infrastructure';
import { FirehoseInfrastructure } from './kinesis-firehose-infrastructure';
import { BeamDashboard } from './cloudwatch-dashboard';
import { Duration } from '@aws-cdk/core';
import { EmptyBucketOnDelete } from './empty-bucket';
import { CodeGuruProfilerInfrastructure } from './codeguru-profiler-infrastructure';

export interface StackProps extends cdk.StackProps {
  build?: boolean,
  demoInfrastructure?: boolean,
  completeInfrastructure?: boolean,
  kinesisReplayVersion: string,
  consumerApplicationVersion: string,
  consumerApplicationJarObject: string,
}

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.templateOptions.description = 'Creates sample Apache Beam pipeline that can be deployed to Kinesis Data Analytics for Java Applications and Amazon EMR (amazon-kinesis-analytics-beam-taxi-consumer)'

    const bucket = new s3.Bucket(this, 'Bucket', {
      versioned: true
    });

    const emptyBucket = new EmptyBucketOnDelete(this, 'EmptyBucket', {
      bucket: bucket
    });

    new cdk.CfnOutput(this, 'S3Bucket', { value: bucket.bucketName });


    const consumerBuild = new GithubBuildPipeline(this, 'BeamTaxiConsumerBuildPipeline', {
      bucket: bucket,
      url: `https://github.com/aws-samples/amazon-kinesis-analytics-beam-taxi-consumer/archive/${props.consumerApplicationVersion}.zip`,
      extract: true,
    });

    if (!(props.demoInfrastructure || props.completeInfrastructure)) {
      return;
    }

    const keyName = new cdk.CfnParameter(this, 'KeyName', {
      type: 'AWS::EC2::KeyPair::KeyName'
    }).valueAsString;

    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });

    const lambdaSource = fs.readFileSync('lambda/add-approximate-arrival-time.js').toString();

    const enrichEvents = new lambda.Function(this, 'EnrichEventsLambda', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.inline(lambdaSource),
      timeout: Duration.seconds(60),
      handler: 'index.handler'
    });

    const replay = new KinesisReplay(this, 'KinesisReplayInfrastructure', {
      ...props,
      bucket: bucket,
      keyName: keyName,
      vpc: vpc
    });

    const emr = new EmrInfrastructure(this, 'EmrInfrastructure', {
      bucket: bucket,
      keyName: keyName,
      vpc: vpc
    });

    if (!props.completeInfrastructure) {
      new cdk.CfnOutput(replay, 'KinesisReplayCommand', { value: `java -jar amazon-kinesis-replay-*.jar -streamRegion ${cdk.Aws.REGION} -objectPrefix artifacts/kinesis-analytics-taxi-consumer/taxi-trips-partitioned.json.lz4/dropoff_year=2018/ -speedup 720 -streamName beam-summit` });
      new cdk.CfnOutput(emr, 'StartFlinkApplication', { value: `flink run -p 8 ${props.consumerApplicationJarObject} --runner=FlinkRunner --inputS3Pattern=s3://${bucket.bucketName}/kinesis-stream-data/*/*/*/*/* --inputStreamName=beam-summit --awsRegion=${cdk.Aws.REGION} --source=s3 --outputBoroughs=true` });

      return;
    }

    const stream = new kds.Stream(this, 'InputStream', {
      shardCount: 4
    });

    const role = new iam.Role(this, 'KinesisAnalyticsRole', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com')
    });

    const dashboard = new BeamDashboard(this, 'Dashboard', {
      inputStream: stream,
      dashboardName: cdk.Aws.STACK_NAME
    });

    new FirehoseInfrastructure(this, 'FirehoseInfrastructure', {
      bucket: bucket,
      emptyBucket: emptyBucket,
      inputStream: stream,
      lambda: enrichEvents,
      buildSuccessWaitCondition: consumerBuild.buildSuccessWaitCondition
    });

    new KinesisAnalyticsJava(this, 'FlinkInfrastructure', {
      ...props,
      dashboard: dashboard,
      bucket: bucket,
      role: role,
      inputStream: stream,
      buildSuccessWaitCondition: consumerBuild.buildSuccessWaitCondition,
    });

    new CodeGuruProfilerInfrastructure(this, 'CodeGuruProfilerInfrastructure', {
      groupName: 'flink-beam-app',
      role: role,
    })

    new cdk.CfnOutput(replay, 'KinesisReplayCommand', { value: `java -jar amazon-kinesis-replay-*.jar -streamRegion ${cdk.Aws.REGION} -streamName ${stream.streamName} -objectPrefix artifacts/kinesis-analytics-taxi-consumer/taxi-trips-partitioned.json.lz4/dropoff_year=2018/ -speedup 720` });
    new cdk.CfnOutput(emr, 'StartFlinkApplication', { value: `flink run -p 8 ${props.consumerApplicationJarObject} --runner=FlinkRunner --inputS3Pattern=s3://${bucket.bucketName}/kinesis-stream-data/*/*/*/*/* --awsRegion=${cdk.Aws.REGION} --inputStreamName=${stream.streamName} --source=s3 --outputBoroughs=true` });
  }
}
