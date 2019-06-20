import cdk = require('@aws-cdk/cdk');
import s3 = require('@aws-cdk/aws-s3');
import lambda = require('@aws-cdk/aws-lambda');
import { KinesisReplay } from './amazon-kinesis-replay';
import { BeamBuildPipeline } from './beam-taxi-count-build';
import { EmrInfrastructure } from './emr-infrastructure';
/*
import kds = require('@aws-cdk/aws-kinesis');
import { KinesisAnalyticsJava } from './kinesis-analytics-infrastructure';
import { FirehoseInfrastructure } from './kinesis-firehose-infrastructure';
import { BeamDashboard } from './cloudwatch-dashboard';
*/

export interface StackProps extends cdk.StackProps {
  build?: boolean,
  infrastructure?: boolean
}

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const keyName = `shausma-${this.region}`;

    const bucket = new s3.Bucket(this, 'Bucket', {
      versioned: true
    });

    if (props.build) {
      new BeamBuildPipeline(this, 'BuildPipeline', {
        bucket: bucket,
        region: 'us-west-2',
        accountId: this.accountId
      });
    }

    if (props.infrastructure) {
      new lambda.Function(this, 'EnrichEventsLambda', {
        runtime: lambda.Runtime.NodeJS810,
        code: lambda.Code.asset('lambda'),
        timeout: 300,
        handler: 'add-approximate-arrival-time.handler'
      });
      
      new KinesisReplay(this, 'KinesisReplayInfrastructure', {
        bucket: bucket,
        keyName: keyName
      });
  
      new EmrInfrastructure(this, 'EmrInfrastructure', {
        bucket: bucket,
        keyName: keyName,
        region: this.region
      });
    
      new cdk.CfnOutput(this, 'BeamReplay', { value: `java -jar amazon-kinesis-replay-*.jar -streamRegion ${this.region} -bucketName shausma-nyc-tlc -objectPrefix yellow-trip-data/taxi-trips-2018-odd.json/ -bucketRegion eu-west-1 -speedup 1440 -streamName beam-summit` });
      new cdk.CfnOutput(this, 'StartFlinkApplication', { value: `flink run -p 32 beam-taxi-count-*.jar --runner=FlinkRunner --inputS3Pattern=s3://${bucket.bucketName}/kinesis-stream-data/*/*/*/*/* --inputStreamName=beam-summit --awsRegion=${this.region} --source=s3 --outputBoroughs=true` });
    }


    /*
    const stream = new kds.Stream(this, 'InputStream', {
      shardCount: 8
    });

    const dashboard = new BeamDashboard(this, 'Dashboard', {
      inputStream: stream
    });

    new FirehoseInfrastructure(this, 'FirehoseInfrastructure', {
      bucket: bucket,
      inputStream: stream,
      lambda: enrichEvents
    });

    new KinesisAnalyticsJava(this, 'FlinkInfrastructure', {
      dashboard: dashboard,
      bucket: bucket,
      inputStream: stream,
      accountId: this.accountId,
      region: this.region
    });
    */

     //new cdk.CfnOutput(this, 'BeamReplay', { value: `java -jar amazon-kinesis-replay-*.jar -streamRegion ${this.region} -streamName ${stream.streamName} -bucketName shausma-nyc-tlc -objectPrefix yellow-trip-data/taxi-trips-2018.json/ -bucketRegion eu-west-1 -speedup 1440` });
     //new cdk.CfnOutput(this, 'StartFlinkApplication', { value: `flink run -p 32 beam-taxi-count-*.jar --runner=FlinkRunner --inputS3Pattern=s3://${bucket.bucketName}/kinesis-stream-data/*/*/*/*/* --awsRegion=${this.region} --inputStreamName=${stream.streamName} --source=s3 --outputBoroughs=true` });

    new cdk.CfnOutput(this, 'S3Bucket', { value: bucket.bucketName });
  }
}