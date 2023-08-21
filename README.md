## Amazon Managed Service for Apache Flink - Beam Taxi Consumer

--------
>  #### 🚨 August 30, 2023: Amazon Kinesis Data Analytics has been renamed to [Amazon Managed Service for Apache Flink](https://aws.amazon.com/managed-service-apache-flink).
--------

Sample Apache Beam pipeline that can be deployed to Kinesis Data Analytics for Java Applications. It reads taxi events from a Kinesis data stream, processes and aggregates them, and ingests the result to Amazon CloudWatch for visualization.

![Architecture Diagram](misc/architecture.png?raw=true)

To see the sample Beam pipeline in action, simply execute [this](cdk/cdk.out/BeamTaxiCount-Complete.template.json) AWS CloudFormation template in your own AWS account. The template first builds the Beam pipeline that is analyzing the incoming taxi trips and then creates the infrastructure and deploys the Flink application to Kinesis Data Analytics for Java Applications.

To populate the Kinesis data stream, we use a Java application that replays a public data set of historic taxi trips made in New York City into the data stream. The Java application can be downloaded to an Amazon EC2 instance that has been provisioned by CloudFormation, you just need to connect to the instance to download and execute the jar file to start ingesting events into the stream.

Note that all of the following commands, including their correct parameters, can be obtained from the output section of the CloudFormation template that has been executed previously.

```
$ ssh ec2-user@«Replay instance DNS name»

$ aws s3 cp --recursive --exclude '*' --include 'amazon-kinesis-replay-*.jar' 's3://«AWS bucket name»/target/' .

$ java -jar amazon-kinesis-replay-*.jar -objectPrefix artifacts/kinesis-analytics-taxi-consumer/taxi-trips-partitioned.json.lz4/dropoff_year=2018 -streamName «Kinesis data stream name» -streamRegion «AWS region» -speedup 720
```

Once data is being ingested into the Kinesis data stream, you can start the processing with the Beam pipeline. Just navigate to the created Kinesis Data Analytics application in the management console and press the run button. You can then find the generated metrics in an Amazon CloudWatch dashboard that has already been created.


![CloudWatch Dashboard Screen Shot](misc/cloudwatch-dashboard-screenshot.png?raw=true)

By default, the Beam pipeline will only output of the overall trip count. To obtain a more fine grained visualisation per borough, you need to change the configuration of the application: Navigate to the Kinesis Analytics application and choose configure. Then, change the value of the property `OutputBoroughs` from `false` to `true` in the property group BeamApplicationProperties under Properties.

Once the application has been reconfigured and is running again, it will output the trip count per borough for all new events. However, it does not backfill these metrics for events that have already been processed. To backfill these fine grained metrics for historic values, you can execute the Beam pipeline in a batch processing fashion on EMR. Connect to the provisioned Amazon Elastic Map Reduce cluster and submit the Jar file of the Beam pipeline to Apache Flink.

```
$ ssh -C -D 8157 hadoop@«EMR master node DNS name»

$ aws s3 cp --recursive --exclude '*' --include 'amazon-kinesis-analytics-beam-taxi-consumer-*.jar' 's3://«AWS bucket name»/target/' .

$ flink-yarn-session -n 2 -s 4 -tm 16GB -d

$ flink run -p 8 amazon-kinesis-analytics-beam-taxi-consumer-*.jar --runner=FlinkRunner --inputS3Pattern=s3://«S3 bucket name»/kinesis-stream-data/*/*/*/*/* --inputStreamName=«Kinesis stream name» --awsRegion=«AWS region» --source=s3 --outputBoroughs=true
```

Alternatively, you can run the backfill job on Amazon Kinesis Data Analytics (KDA) in a fully managed Flink environment. You just need to change the `Source` to `s3` in the  properties section of the KDA application. Once the backfill job completes, a Lambda function that is monitoring the appliaction output through a CloudWatch metric filter will stop the KDA application.

![CloudWatch Dashboard Screen Shot](misc/cloudwatch-dashboard-screenshot-boroughs.png?raw=true)

## License Summary

This sample code is made available under the MIT-0 license. See the LICENSE file.
