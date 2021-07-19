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

import com.amazonaws.samples.beam.taxi.count.kinesis.TripEvent;
import com.opencsv.bean.CsvBindByName;
import com.opencsv.bean.CsvToBeanBuilder;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.values.KV;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.io.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PartitionByBorough extends DoFn<TripEvent, KV<String,TripEvent>> {

  private static final Logger LOG = LoggerFactory.getLogger(PartitionByBorough.class);

  private transient Map<Integer, String> boroughs;


  @Setup
  public void setup() {
    S3Client s3 = S3Client.builder().region(Region.US_EAST_1).build();

    GetObjectRequest request = GetObjectRequest.builder().bucket("nyc-tlc").key("misc/taxi _zone_lookup.csv").build();
    InputStream stream = new BufferedInputStream(s3.getObject(request));
    Reader reader = new InputStreamReader(stream);

    boroughs = new HashMap<>();
    List<TaxiZone> zones = new CsvToBeanBuilder(reader).withType(TaxiZone.class).build().parse();

    for (TaxiZone zone : zones) {
      boroughs.put(zone.id, zone.borough);
    }

    LOG.info("found {} boroughs: {}", boroughs.size(), boroughs.toString());
  }


  @ProcessElement
  public void process(ProcessContext c) {
    int pickupLocationId = c.element().pickupLocationId;
    String borough = boroughs.getOrDefault(pickupLocationId, "Unknown");

    LOG.debug("resolve location {} to boroughs {}", pickupLocationId, borough);

    c.output(KV.of(borough, c.element()));
  }


  public static class TaxiZone implements Serializable {
    @CsvBindByName(column = "LocationID", required = true)
    public final int id;

    @CsvBindByName(column = "Borough", required = true)
    public final String borough;

    @CsvBindByName(column = "Zone", required = true)
    public final String zone;

    public TaxiZone() {
      id = 0;
      borough = "";
      zone = "";
    }
  }
}
