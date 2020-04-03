import fs = require('fs');
import cdk = require('@aws-cdk/core');
import kds = require('@aws-cdk/aws-kinesis');
import kda = require('@aws-cdk/aws-kinesisanalytics');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import subs = require('@aws-cdk/aws-sns-subscriptions');
import cloudwatch = require('@aws-cdk/aws-cloudwatch')
import cloudwatch_actions = require('@aws-cdk/aws-cloudwatch-actions')
import lambda = require('@aws-cdk/aws-lambda');
import logs = require('@aws-cdk/aws-logs');
import { Bucket } from '@aws-cdk/aws-s3';
import cfn = require('@aws-cdk/aws-cloudformation');
import sns = require('@aws-cdk/aws-sns');
import { RetentionDays } from '@aws-cdk/aws-logs';
import { TreatMissingData, ComparisonOperator } from '@aws-cdk/aws-cloudwatch';
import { Duration } from '@aws-cdk/core';


export interface KinesisAnalyticsProps {
    dashboard: cloudwatch.Dashboard,
    bucket: s3.Bucket,
    inputStream: kds.Stream,
    buildSuccessWaitCondition: cfn.CfnWaitCondition,
    applicationName: string,
}

export class KinesisAnalyticsJava extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: KinesisAnalyticsProps) {
        super(scope, id);
    
        const role = new iam.Role(this, 'KinesisAnalyticsRole', {
            assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com')
        });

        const logGroup = new logs.LogGroup(this, 'FlinkLogGroup', {
            retention: RetentionDays.ONE_WEEK
        });

        new cdk.CfnOutput(this, 'FlinkLogGroupName', { value: logGroup.logGroupName });

                
        props.bucket.grantRead(role);
        props.inputStream.grantRead(role);
        cloudwatch.Metric.grantPutMetricData(role);

        logGroup.grantWrite(role);
        logGroup.grant(role, "logs:DescribeLogStreams");
        role.addToPolicy(
            new iam.PolicyStatement({
                actions: ['logs:DescribeLogGroups'],
                resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:*`]
            })
        );

        const bucket = Bucket.fromBucketName(this, 'TclBucket', 'nyc-tlc');
        bucket.grantRead(role);
        
        const logStream = new logs.LogStream(this, 'FlinkLogStream', {
            logGroup: logGroup
        });

        const flinkApp = new kda.CfnApplicationV2(this, 'FlinkApplication', {
            runtimeEnvironment: 'FLINK-1_6',
            serviceExecutionRole: role.roleArn,
            applicationName: props.applicationName,
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
                                AwsRegion: cdk.Aws.REGION,
                                InputStreamName: props.inputStream.streamName,
                                OutputBoroughs: 'false',
                                InputS3Pattern: `s3://${props.bucket.bucketName}/kinesis-stream-data/*/*/*/*/*`,
                                Source: 'kinesis',
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
                        autoScalingEnabled: false,
                        parallelism: 4,
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
            applicationName: flinkApp.ref.toString(),
            cloudWatchLoggingOption: {
                logStreamArn: `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${logGroup.logGroupName}:log-stream:${logStream.logStreamName}`
            }
        });

        flinkApp.node.addDependency(props.buildSuccessWaitCondition);


        const lambdaSource = fs.readFileSync('lambda/stop-kda-app.py').toString();

        const terminateAppLambda =  new lambda.Function(this, 'TerminateAppLambda', {
            runtime: lambda.Runtime.PYTHON_3_7,
            timeout: Duration.minutes(15),
            code: lambda.Code.inline(lambdaSource),
            handler: 'index.empty_bucket',
            memorySize: 512,
            environment: {
                application_name: flinkApp.ref,
            }
        });

        terminateAppLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['kinesisanalytics:StopApplication'],
                resources: [`arn:${cdk.Aws.PARTITION}:kinesisanalytics:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:application/${flinkApp.ref}`]
            })
        );

        new logs.MetricFilter(this, 'AppTerminatedFilter', {
            filterPattern: logs.FilterPattern.literal('Job reached globally terminal state FINISHED'),
            metricNamespace: 'Beam',
            metricName: 'BeamApplicationFinished',
            metricValue: '1',
            defaultValue: 0,
            logGroup: logGroup
        });

        const metric = new cloudwatch.Metric({
            namespace: 'Beam',
            metricName: 'BeamApplicationFinished',
            period: cdk.Duration.minutes(1)
        });

        const alarm = metric.createAlarm(this, 'AppTerminatedAlarm', {
            threshold: 0,
            actionsEnabled: true,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 1,
            statistic: "sum"
        });

        const topic = new sns.Topic(this, 'AppTerminatedTopic');

        topic.addSubscription(new subs.LambdaSubscription(terminateAppLambda));

        alarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic));
    }
}