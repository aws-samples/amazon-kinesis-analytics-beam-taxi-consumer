## Amazon Kinesis Analytics Beam Taxi Consumer

Sample Apache Beam pipeline that can be deployed to Kinesis Analytics for Java Applications. It reads taxi events from a Kinesis data stream, processes and aggregates them, and ingests the result to Amazon CloudWatch for visualization.

To see the sample Beam pipeline in action, simply execute the following AWS Cloud Development Kit (CDK) template in your own AWS account. The template first builds the Beam pipeline that is analyzing the incoming taxi trips and then creates the infrastructure and submits the Flink application to KDA for Java.

```
$ git clone https://github.com/aws-samples/amazon-kinesis-analytics-beam-taxi-consumer

$ cd cdk

$ cdk deploy '*'
```

To populate the Kinesis data stream, we use a Java application that replays a public data set of historic taxi trips made in New York City into the data stream. The Java application has already been downloaded to an EC2 instance that has been provisioned by CDK, you just need to connect to the instance and execute the jar file to start ingesting events into the stream.

Note that all of the following commands, including their correct parameters, can be obtained from the output section of the CDK template that has been executed previously.

```
$ ssh ec2-user@«Replay instance DNS name»

$ java -jar amazon-kinesis-replay-1.0.jar -streamName «Kinesis data stream name» -streamRegion «AWS region» -speedup 1440
```

Once data is being ingested into the Kinesis data stream, you can start the processing with the Beam pipeline. Just navigate to the created Kinesis Data Analytics application in the management console and press the 
run botton. You can then find the generated metrics in an Amazon CloudWatch dashboard that has already been created.


![CloudWatch Dashboard Screen Shot](misc/cloudwatch-dashboard-screenshot.png?raw=true)


To execute the Beam pipeline in a batch processing fashion. Connect to the provisioned Amazon Elastic Map Reduce (EMR) cluster and submit the Jar file of the Beam pipeline to Apache Flink.

```
$ ssh -C -D 8157 hadoop@«EMR master node DNS name»

$ flink-yarn-session -n 2 -s 16 -tm 64GB -d

$ flink run -p 32 beam-taxi-count-*.jar --runner=FlinkRunner --inputS3Pattern=s3://«S3 bucket name»/kinesis-stream-data/*/*/*/*/* --inputStreamName=«Kinesis stream name» --awsRegion=«AWS region» --source=s3 --outputBoroughs=true
```


## License Summary

This sample code is made available under the MIT-0 license. See the LICENSE file.