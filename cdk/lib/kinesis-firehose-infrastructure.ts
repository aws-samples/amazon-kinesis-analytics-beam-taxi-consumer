import cdk = require('@aws-cdk/cdk');
import kds = require('@aws-cdk/aws-kinesis');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import kdf = require('@aws-cdk/aws-kinesisfirehose');
import lambda = require('@aws-cdk/aws-lambda');
import cfn = require('@aws-cdk/aws-cloudformation');

export interface FirehoseProps {
    bucket: s3.Bucket,
    inputStream: kds.Stream,
    lambda: lambda.Function,
    buildSuccessWaitCondition: cfn.CfnWaitCondition
}

export class FirehoseInfrastructure extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: FirehoseProps) {
        super(scope, id);
      
        const firehoseRole = new iam.Role(this, 'FirehoseRole', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
        });

        props.inputStream.grantRead(firehoseRole);
        props.bucket.grantReadWrite(firehoseRole);
        props.lambda.grantInvoke(firehoseRole);
    
        const firehose = new kdf.CfnDeliveryStream(this, 'FirehoseDeliveryStream', {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputStream.streamArn,
                roleArn: firehoseRole.roleArn,
            },
            extendedS3DestinationConfiguration: {
                bucketArn: props.bucket.bucketArn,
                bufferingHints: {
                    intervalInSeconds: 300,
                    sizeInMBs: 128
                },
                compressionFormat: 'GZIP',
                roleArn: firehoseRole.roleArn,
                prefix: 'kinesis-stream-data/',
                processingConfiguration: {
                    enabled: true,
                    processors: [
                        {
                            type: 'Lambda',
                            parameters: [
                                {
                                    parameterName: 'LambdaArn',
                                    parameterValue: props.lambda.functionArn
                                }
                            ]
                        }
                    ]
                }
            }
        });

        //atrificially delay creation of the delivery stream; due to bug in cdk, creation would fail
        firehose.node.addDependency(props.buildSuccessWaitCondition);
    }
}