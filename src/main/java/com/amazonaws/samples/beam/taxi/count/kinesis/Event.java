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

package com.amazonaws.samples.beam.taxi.count.kinesis;

import com.google.gson.*;
import com.google.gson.internal.Streams;
import com.google.gson.stream.JsonReader;
import org.apache.beam.sdk.coders.DefaultCoder;
import org.apache.beam.sdk.coders.SerializableCoder;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.io.Serializable;
import java.nio.charset.StandardCharsets;


@DefaultCoder(SerializableCoder.class)
public abstract class Event implements Serializable {
  private static final String TYPE_FIELD = "type";

  private static final Logger LOG = LoggerFactory.getLogger(Event.class);

  private static final Gson gson = new GsonBuilder()
      .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
      .registerTypeAdapter(Instant.class, (JsonDeserializer<Instant>) (json, typeOfT, context) -> Instant.parse(json.getAsString()))
      .create();

  public static Event parseEvent(String event) {
    return parseEvent(event.getBytes(StandardCharsets.UTF_8));
  }

  public static Event parseEvent(byte[] event) {
    //parse the event payload and remove the type attribute
    JsonReader jsonReader =  new JsonReader(new InputStreamReader(new ByteArrayInputStream(event)));
    JsonElement jsonElement = Streams.parse(jsonReader);
    JsonElement labelJsonElement = jsonElement.getAsJsonObject().remove(TYPE_FIELD);

    if (labelJsonElement == null) {
      throw new IllegalArgumentException("Event does not define a type field: " + new String(event));
    }

    //convert json to POJO, based on the type attribute
    switch (labelJsonElement.getAsString()) {
      case "watermark":
        return gson.fromJson(jsonElement, WatermarkEvent.class);
      case "trip":
        return gson.fromJson(jsonElement, TripEvent.class);
      default:
        throw new IllegalArgumentException("Found unsupported event type: " + labelJsonElement.getAsString());
    }
  }

  /**
   * @return timestamp in epoch millies
   */
  public abstract Instant getTimestamp();
}