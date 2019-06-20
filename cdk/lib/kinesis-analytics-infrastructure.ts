import cdk = require('@aws-cdk/cdk');
import kds = require('@aws-cdk/aws-kinesis');
//import kda = require('@aws-cdk/aws-kinesisanalytics');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import cloudwatch = require('@aws-cdk/aws-cloudwatch')
import logs = require('@aws-cdk/aws-logs');
import { Bucket } from '@aws-cdk/aws-s3';



export interface KinesisAnalyticsProps {
    dashboard: cloudwatch.Dashboard,
    bucket: s3.Bucket,
    inputStream: kds.Stream,
    region: string,
    accountId: string
}

export class KinesisAnalyticsJava extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: KinesisAnalyticsProps) {
        super(scope, id);
    
        const role = new iam.Role(this, 'KinesisAnalyticsRole', {
            assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com')
        });

        const logGroup = new logs.LogGroup(this, 'FlinkLogGroup', {
            retentionDays: 7
        });

        new cdk.CfnOutput(this, 'FlinkLogGroupName', { value: logGroup.logGroupName });

                
        props.bucket.grantRead(role);
        props.inputStream.grantRead(role);
        cloudwatch.Metric.grantPutMetricData(role);

        logGroup.grantWrite(role);
        logGroup.grant(role, "logs:DescribeLogStreams");
        role.addToPolicy(
            new iam.PolicyStatement()
                .allow()
                .addAction('logs:DescribeLogGroups')
                .addResource(`arn:aws:logs:${props.region}:${props.accountId}:log-group:*`)
        );

        const bucket = Bucket.fromBucketName(this, 'TclBucket', 'nyc-tlc');
        bucket.grantRead(role);

        /*
        
        const logStream = new logs.LogStream(this, 'FlinkLogStream', {
            logGroup: logGroup
        });

        const flinkApp = new kda.CfnApplicationV2(this, 'FlinkApplication', {
            runtimeEnvironment: 'FLINK-1_6',
            serviceExecutionRole: role.roleArn,
            applicationConfiguration: {
                applicationCodeConfiguration: {
                    codeContent: {
                        s3ContentLocation: {
                            bucketArn: props.bucket.bucketArn,
                            fileKey: 'target/beam-taxi-count-1.0-SNAPSHOT.jar'
                        }
                    },
                    codeContentType: 'ZIPFILE'
                },
                environmentProperties: {
                    propertyGroups: [
                        {
                            propertyGroupId: 'BeamApplicationProperties',
                            propertyMap: {
                                InputType: 'kinesis',
                                InputStreamName: props.inputStream.streamName,
                                AwsRegion: props.region,
                                OutputBoroughs: 'false'
                            }
                        }
                    ]
                },
                flinkApplicationConfiguration: {
                    monitoringConfiguration: {
                        logLevel: 'INFO',
                        metricsLevel: 'TASK',
                        configurationType: 'CUSTOM'
                    },
                    parallelismConfiguration: {
                        autoScalingEnabled: true,
                        parallelism: 1,
                        parallelismPerKpu: 1,
                        configurationType: 'CUSTOM'
                    }
                },
                applicationSnapshotConfiguration: {
                    snapshotsEnabled: false
                }
            }
        });

        new kda.CfnApplicationCloudWatchLoggingOptionV2(this, 'FlinkLogging', {
            applicationName: flinkApp.ref,
            cloudWatchLoggingOption: {
                logStreamArn: `arn:aws:logs:${props.region}:${props.accountId}:log-group:${logGroup.logGroupName}:log-stream:${logStream.logStreamName}`
            }
        });
        */
    }
}