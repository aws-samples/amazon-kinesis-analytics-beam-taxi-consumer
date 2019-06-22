import cdk = require('@aws-cdk/cdk');
import kds = require('@aws-cdk/aws-kinesis');
import cloudwatch = require('@aws-cdk/aws-cloudwatch')
import { Metric } from '@aws-cdk/aws-cloudwatch';


export interface BeamDashboardProps {
    inputStream: kds.Stream
}

export class BeamDashboard extends cloudwatch.Dashboard {
    constructor(scope: cdk.Construct, id: string, props: BeamDashboardProps) {
        super(scope, id);

        const iteratorAge = new Metric({
          namespace: 'AWS/Kinesis',
          metricName: 'GetRecords.IteratorAgeMilliseconds',
          dimensions: {
            StreamName: props.inputStream.streamName
          },
          periodSec: 60,
          statistic: 'max'
        });
    
        const incomingRecords = new Metric({
          namespace: 'AWS/Kinesis',
          metricName: 'IncomingRecords',
          dimensions: {
            StreamName: props.inputStream.streamName
          },
          periodSec: 60,
          statistic: 'sum'
        });  
    
        this.addWidgets(new cloudwatch.GraphWidget({
          left: [iteratorAge],
          right: [incomingRecords],
          width: 24
        }));
    
        this.addWidgets(new cloudwatch.GraphWidget({
          left: [
            new Metric({
              namespace: 'Beam',
              metricName: 'Number of Trips',
              dimensions: {
                StreamName: props.inputStream.streamName
              },
              periodSec: 5,
              statistic: 'max'
            })        
          ],
          width: 24
        }));
    
        let toMetric = (statistic: string) => (borough: string) => new Metric({
          namespace: 'Beam',
          metricName: 'Number of Trips',
          dimensions: {
            StreamName: props.inputStream.streamName,
            Borough: borough
          },
          periodSec: 5,
          statistic: statistic
        });
    
        this.addWidgets(new cloudwatch.GraphWidget({
          left: ['Bronx', 'Brooklyn', 'Queens', 'Staten Island'].map(toMetric('max')),
          right: ['Manhattan', 'Unknown'].map(toMetric('max')),
          width: 24
        }));
    
        this.addWidgets(new cloudwatch.GraphWidget({
          left: ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island'].map(toMetric('samplecount')),
          width: 24
        }));    
    }
}