## Amazon Kinesis Analytics Beam Taxi Consumer

Sample Apache Beam pipeline that can be deployed to Kinesis Analytics for Java Applications. It reads taxi events from a Kinesis data stream, processes and aggregates them, and ingests the result to Amazon CloudWatch for visualization.

To see the sample Beam pipeline in action, simply execute [this](cdk/cdk.out/BeamTaxiCount-Complete.template.json) AWS CloudFormation (CFN) template in your own AWS account. The template first builds the Beam pipeline that is analyzing the incoming taxi trips and then creates the infrastructure and submits the Flink application to KDA for Java.

To populate the Kinesis data stream, we use a Java application that replays a public data set of historic taxi trips made in New York City into the data stream. The Java application can be downloaded to an EC2 instance that has been provisioned by CFN, you just need to connect to the instance to download and execute the jar file to start ingesting events into the stream.

Note that all of the following commands, including their correct parameters, can be obtained from the output section of the CFN template that has been executed previously.

```
$ ssh ec2-user@«Replay instance DNS name»

$ aws s3 cp --recursive --exclude '*' --include 'amazon-kinesis-replay-*.jar' 's3://«AWS bucket name»/target/' .

$ java -jar amazon-kinesis-replay-1.0.jar -objectPrefix artifacts/kinesis-analytics-taxi-consumer/taxi-trips-partitioned.json.lz4/dropoff_year=2018 -streamName «Kinesis data stream name» -streamRegion «AWS region» -speedup 720
```

Once data is being ingested into the Kinesis data stream, you can start the processing with the Beam pipeline. Just navigate to the created Kinesis Data Analytics application in the management console and press the 
run botton. You can then find the generated metrics in an Amazon CloudWatch dashboard that has already been created.


![CloudWatch Dashboard Screen Shot](misc/cloudwatch-dashboard-screenshot.png?raw=true)


To execute the Beam pipeline in a batch processing fashion. Connect to the provisioned Amazon Elastic Map Reduce (EMR) cluster and submit the Jar file of the Beam pipeline to Apache Flink.

```
$ ssh -C -D 8157 hadoop@«EMR master node DNS name»

$ aws s3 cp --recursive --exclude '*' --include 'beam-taxi-count-*.jar' 's3://«AWS bucket name»/target/' .

$ flink-yarn-session -n 2 -s 4 -tm 16GB -d

$ flink run -p 8 beam-taxi-count-*.jar --runner=FlinkRunner --inputS3Pattern=s3://«S3 bucket name»/kinesis-stream-data/*/*/*/*/* --inputStreamName=«Kinesis stream name» --awsRegion=«AWS region» --source=s3 --outputBoroughs=true
```

![CloudWatch Dashboard Screen Shot](misc/cloudwatch-dashboard-screenshot-boroughs.png?raw=true)

## License Summary

This sample code is made available under the MIT-0 license. See the LICENSE file.
