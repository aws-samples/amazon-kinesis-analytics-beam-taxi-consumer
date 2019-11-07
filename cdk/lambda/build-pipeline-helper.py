import os
import json
import boto3
import urllib.request
from botocore.vendored import requests

s3 = boto3.client('s3')
code_pipeline = boto3.client('codepipeline')


def download_sources(event, context):
    url = os.environ['url']
    bucket = os.environ['bucket']
    key = os.environ['key']

    try:
        req = urllib.request.Request(url)
        response = urllib.request.urlopen(req)

        s3.put_object(Bucket=bucket, Key=key, Body=response.read())

        send(event, context, SUCCESS, {})
    except Exception as e:
        print("exception: " + str(e))
        send(event, context, FAILED, {})


def notify_build_success(event, context):
    job_id = event['CodePipeline.job']['id']

    url = os.environ['waitHandleUrl']
    headers = { "Content-Type": "" }
    data = { "Status": "SUCCESS", "Reason": "Compilation Succeeded", "UniqueId": job_id, "Data": "Compilation Succeeded" }

    try:
        req = urllib.request.Request(url, headers=headers, data=bytes(json.dumps(data), encoding="utf-8"), method='PUT')
        response = urllib.request.urlopen(req)

        code_pipeline.put_job_success_result(jobId=job_id)
    except Exception as e:
        print("exception: " + str(e))
        code_pipeline.put_job_failure_result(jobId=job_id, failureDetails={'message': str(e), 'type': 'JobFailed'})


#  Copyright 2016 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
#  This file is licensed to you under the AWS Customer Agreement (the "License").
#  You may not use this file except in compliance with the License.
#  A copy of the License is located at http://aws.amazon.com/agreement/ .
#  This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied.
#  See the License for the specific language governing permissions and limitations under the License.
  
SUCCESS = "SUCCESS"
FAILED = "FAILED"
 
def send(event, context, responseStatus, responseData, physicalResourceId=None, noEcho=False):
    responseUrl = event['ResponseURL']
 
    print(responseUrl)
 
    responseBody = {}
    responseBody['Status'] = responseStatus
    responseBody['Reason'] = 'See the details in CloudWatch Log Stream: ' + context.log_stream_name
    responseBody['PhysicalResourceId'] = physicalResourceId or context.log_stream_name
    responseBody['StackId'] = event['StackId']
    responseBody['RequestId'] = event['RequestId']
    responseBody['LogicalResourceId'] = event['LogicalResourceId']
    responseBody['NoEcho'] = noEcho
    responseBody['Data'] = responseData
 
    json_responseBody = json.dumps(responseBody)
 
    print("Response body:\n" + json_responseBody)
 
    headers = {
        'content-type' : '',
        'content-length' : str(len(json_responseBody))
    }
 
    try:
        response = requests.put(responseUrl,
                                data=json_responseBody,
                                headers=headers)
        print("Status code: " + response.reason)
    except Exception as e:
        print("send(..) failed executing requests.put(..): " + str(e))