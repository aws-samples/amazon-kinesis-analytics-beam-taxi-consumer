/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

package com.amazonaws.samples.beam.taxi.count;

import avro.shaded.com.google.common.collect.Iterables;
import java.util.ArrayList;
import java.util.Collection;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.values.KV;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.*;

public class CloudWatchSink extends DoFn<KV<Void,Iterable<Metric>>, Void> {
  private static final Logger LOG = LoggerFactory.getLogger(CloudWatchSink.class);

  private final Dimension streamName;
  private transient CloudWatchClient cloudwatch;

  public CloudWatchSink(Dimension streamName) {
    this.streamName = streamName;
  }

  @Setup
  public void setup() {
    cloudwatch = CloudWatchClient.builder().build();
  }

  @ProcessElement
  public void process(ProcessContext c) {
    Collection<MetricDatum> metrics = StreamSupport
        .stream(c.element().getValue().spliterator(), true)
        .map(new Function<Metric, MetricDatum>() {
             @Override
             public MetricDatum apply(Metric metric) {
               Dimension[] dimensions;

               if (metric.borough == null) {
                 dimensions = new Dimension[]{ streamName };
               } else {
                 Dimension borough = Dimension
                     .builder()
                     .name("Borough")
                     .value(metric.borough)
                     .build();

                 dimensions = new Dimension[]{ streamName, borough };
               }


               return MetricDatum.builder()
                   .metricName("Number of Trips")
                   .storageResolution(1)
                   .dimensions(dimensions)
                   .timestamp(metric.timestamp)
                   .value((double) metric.count)
                   .unit(StandardUnit.COUNT)
                   .build();
             }
           }
        )
        .collect(Collectors.toCollection(ArrayList::new));

    PutMetricDataRequest request = PutMetricDataRequest
        .builder()
        .metricData(metrics)
        .namespace("Beam")
        .build();

    final int size = Iterables.size(c.element().getValue());
    final String elements = c.element().getValue().toString();

    PutMetricDataResponse putMetricDataResponse = cloudwatch.putMetricData(request);

    LOG.info("sent {} metrics with status code {}: {}", size, putMetricDataResponse.sdkHttpResponse().statusCode(), elements);
  }

}
