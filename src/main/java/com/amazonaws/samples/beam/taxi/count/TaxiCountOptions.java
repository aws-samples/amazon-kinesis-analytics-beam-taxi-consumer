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

import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import org.apache.beam.runners.flink.FlinkPipelineOptions;
import org.apache.beam.sdk.io.aws.options.AwsOptions;
import org.apache.beam.sdk.options.Default;
import org.apache.beam.sdk.options.Description;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.Properties;

public interface TaxiCountOptions extends FlinkPipelineOptions, AwsOptions {
  Logger LOG = LoggerFactory.getLogger(TaxiCountOptions.class);

  @Description("Name of the Kinesis Data Stream to read from")
  String getInputStreamName();

  void setInputStreamName(String value);


  @Description("S3 bucket name and prefix that contains the historic data")
  String getInputS3Pattern();

  void setInputS3Pattern(String value);


  @Default.String("kinesis")
  String getSource();

  void setSource(String value);


  @Default.Boolean(false)
  boolean getOutputBoroughs();

  void setOutputBoroughs(boolean value);


  static String[] argsFromKinesisApplicationProperties(String[] args, String applicationPropertiesName) {
    Properties beamProperties = null;

    try {
      Map<String, Properties> applicationProperties = KinesisAnalyticsRuntime.getApplicationProperties();
//      Map<String, Properties> applicationProperties  = KinesisAnalyticsRuntime.getApplicationProperties(FlinkPipelineOptions.class.getClassLoader().getResource("application-properties.json").getPath());

      if (applicationProperties == null) {
        LOG.warn("Unable to load application properties from the Kinesis Analytics Runtime");

        return new String[0];
      }

      beamProperties = applicationProperties.get(applicationPropertiesName);

      if (beamProperties == null) {
        LOG.warn("Unable to load {} properties from the Kinesis Analytics Runtime", applicationPropertiesName);

        return new String[0];
      }

      LOG.info("Parsing application properties: {}", applicationPropertiesName);
    } catch (IOException e) {
      LOG.warn("Failed to retrieve application properties", e);

      return new String[0];
    }

    String[] kinesisOptions = beamProperties
        .entrySet()
        .stream()
        .map(property -> String.format("--%s%s=%s",
            Character.toLowerCase(((String) property.getKey()).charAt(0)),
            ((String) property.getKey()).substring(1),
            property.getValue()
        ))
        .toArray(String[]::new);

    return kinesisOptions;
  }
}


