## Amazon Managed Service for Apache Flink - Beam Taxi Consumer

> Amazon Managed Service for Apache Flink was formerly known as Amazon Kinesis Data Analytics

Sample Apache Beam pipeline that can be deployed to Amazon Managed Service for Apache Flink. 
It reads taxi events from a Kinesis data stream, processes and aggregates them, and ingests the result to Amazon CloudWatch for visualization.

The Beam pipeline can also run in batch mode for backfilling, reading a finite dataset from S3.

Application configuration

* Group ID: `BeamApplicationProperties`
  * `InputStreamName` name of the input Kinesis Stream, ignored if `Source` = `s3`
  * `OutputBoroughs`, `true`|`false`, counts trips per borough
  * `Source` either `kinesis`, for stream processing mode, or `s3`, for batch mode
  * `InputS3Pattern` pattern to read backfilling input in batch mode, `s3://<bucket-name>/<path>/*/*/*/*/*`, ignored if `Source` = `kinesis`

## License Summary

This sample code is made available under the MIT-0 license. See the LICENSE file.
