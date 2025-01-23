//filter works but for short time, no download works

import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import * as XLSX from "xlsx";

// Custom icons
import CustomMarkerIconImage from "./custom-marker.png";
import DotIconImage from "./small-dot.png";

// Main CSV marker icon
const CustomMarkerIcon = L.icon({
  iconUrl: CustomMarkerIconImage,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

// Pricing CSV marker icon
const DotIcon = L.icon({
  iconUrl: DotIconImage,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function ZipOverlay() {
  const map = useMap();

  useEffect(() => {
    const url =
      "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/pa_pennsylvania_zip_codes_geo.min.json";

    fetch(url)
      .then((res) => res.json())
      .then((geoData) => {
        const layer = L.geoJSON(geoData, {
          style: {
            color: "#ff7800",
            weight: 1,
            fillColor: "#ffeda0",
            fillOpacity: 0.4,
          },
          onEachFeature: (feature, layerInstance) => {
            const zip = feature.properties.ZCTA5CE10 || "Unknown ZIP";
            layerInstance.bindPopup(`ZIP Code: ${zip}`);
          },
        });
        layer.addTo(map);
      })
      .catch((err) => {
        console.error("Error fetching ZIP code GeoJSON:", err);
      });
  }, [map]);

  return null;
}

function DrawHandler({
  pricingData,
  setFilteredPricingData,
  locations,
  setFilteredLocations,
}) {
  const map = useMap();
  const [controlAdded, setControlAdded] = useState(false);

  const isPointInShape = (lat, lng, layer) => {
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      const distance = map.distance(center, L.latLng(lat, lng));
      return distance <= radius;
    } else {
      const shapeGeoJSON = layer.toGeoJSON();
      const polygonGeometry = polygon(shapeGeoJSON.geometry.coordinates);
      const pt = point([lng, lat]);
      return booleanPointInPolygon(pt, polygonGeometry);
    }
  };

  const handleShapeDrawn = (layer) => {
    const filteredPricing = pricingData.filter((p) => {
      const [lat, lng] = p.coords;
      return isPointInShape(lat, lng, layer);
    });

    const filteredComps = locations.filter((loc) => {
      const [lat, lng] = loc.coords;
      return isPointInShape(lat, lng, layer);
    });

    const combinedData = [
      ...filteredPricing.map((item) => ({
        type: "pricing",
        apn: item.apn,
        lotAcreage: item.lotAcreage,
        latitude: item.coords[0],
        longitude: item.coords[1],
      })),
      ...filteredComps.map((item) => ({
        type: "comps",
        price: item.details.PRICE,
        acres: item.details.ACRES,
        latitude: item.coords[0],
        longitude: item.coords[1],
      })),
    ];

    setFilteredPricingData(combinedData);
  };

  useEffect(() => {
    if (!controlAdded) {
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const drawControl = new L.Control.Draw({
        draw: {
          marker: false,
          polyline: false,
          circle: {
            shapeOptions: { color: "#ff0000" },
            showRadius: true,
          },
          circlemarker: { shapeOptions: { color: "#ff0000" } },
          polygon: {
            shapeOptions: { color: "#0000ff" },
            showArea: true,
          },
          rectangle: { shapeOptions: { color: "#00ff00" } },
        },
        edit: { featureGroup: drawnItems },
      });

      map.addControl(drawControl);
      setControlAdded(true);

      map.on("draw:created", (e) => {
        const { layer } = e;
        drawnItems.addLayer(layer);
        handleShapeDrawn(layer);
      });
    }
  }, [map, controlAdded, pricingData, locations]);

  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [filteredPricingData, setFilteredPricingData] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");

  const mapRef = useRef(null);

  const handleMainCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedData = results.data
          .filter((row) => {
            const lat = parseFloat(row.LATITUDE);
            const lng = parseFloat(row.LONGITUDE);
            return Number.isFinite(lat) && Number.isFinite(lng);
          })
          .map((row) => ({
            coords: [parseFloat(row.LATITUDE), parseFloat(row.LONGITUDE)],
            details: row,
          }));
        setLocations(parsedData);
      },
      error: function (err) {
        console.error("PapaParse Error (Main CSV):", err);
      },
    });
  };

  const handlePricingCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunkSize: 500,
      chunk: function (results) {
        const chunkData = results.data
          .filter((row) => {
            const lat = parseFloat(row.LATITUDE);
            const lng = parseFloat(row.LONGITUDE);
            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              row["APN - FORMATTED"]
            );
          })
          .map((row) => ({
            apn: row["APN - FORMATTED"],
            coords: [parseFloat(row.LATITUDE), parseFloat(row.LONGITUDE)],
            lotAcreage: row["LOT ACREAGE"]
              ? parseFloat(row["LOT ACREAGE"])
              : null,
          }));
        setPricingData((prev) => {
          const updated = [...prev, ...chunkData];
          setFilteredPricingData(updated);
          return updated;
        });
      },
      complete: function () {
        console.log("Pricing CSV parsing complete!");
      },
      error: function (err) {
        console.error("PapaParse Error (Pricing CSV):", err);
      },
    });
  };

  const applyAcreageFilter = () => {
    const minVal = parseFloat(minAcreage);
    const maxVal = parseFloat(maxAcreage);

    if (isNaN(minVal) || isNaN(maxVal)) {
      setFilteredPricingData(pricingData);
      return;
    }

    const filtered = pricingData.filter((pd) => {
      if (pd.lotAcreage == null) return false;
      return pd.lotAcreage >= minVal && pd.lotAcreage <= maxVal;
    });
    setFilteredPricingData(filtered);
  };

  const downloadFilteredDataToExcel = () => {
    if (filteredPricingData.length === 0) {
      alert("No data points to download.");
      return;
    }

    // Separate Pricing and Main data
    const pricingDataTab = filteredPricingData
      .filter((item) => item.type === "pricing")
      .map((item) => ({
        APN: item.apn,
        "LOT ACREAGE": item.lotAcreage,
        Latitude: item.latitude,
        Longitude: item.longitude,
      }));
    const mainDataTab = filteredPricingData
      .filter((item) => item.type === "comps")
      .map((item) => ({
        Price: item.price,
        Acres: item.acres,
        Latitude: item.latitude,
        Longitude: item.longitude,
      }));

    const workbook = XLSX.utils.book_new();
    const pricingSheet = XLSX.utils.json_to_sheet(pricingDataTab);
    const mainSheet = XLSX.utils.json_to_sheet(mainDataTab);

    XLSX.utils.book_append_sheet(workbook, pricingSheet, "Pricing Data");
    XLSX.utils.book_append_sheet(workbook, mainSheet, "Main Data");

    XLSX.writeFile(workbook, "filtered_data.xlsx");

    // Remove exported points from the map and state
    const filteredCoords = new Set(
      filteredPricingData.map((item) =>
        [item.latitude, item.longitude].join(",")
      )
    );

    setLocations((prev) =>
      prev.filter((loc) => !filteredCoords.has(loc.coords.join(",")))
    );
    setPricingData((prev) =>
      prev.filter((pt) => !filteredCoords.has(pt.coords.join(",")))
    );
    setFilteredPricingData([]);
    alert("Filtered data downloaded and removed from the map.");
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      {/* Control Panel */}
      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          top: 10,
          right: 10,
          background: "#f8f9fa",
          padding: "12px 15px",
          borderRadius: "8px",
          boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
          width: "280px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Data Controls</h3>

        {/* Main CSV Upload */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>
            Upload Main CSV:
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleMainCSVUpload}
            style={{ width: "100%", marginTop: "5px" }}
          />
        </div>

        {/* Pricing CSV Upload */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>
            Upload Pricing CSV:
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handlePricingCSVUpload}
            style={{ width: "100%", marginTop: "5px" }}
          />
        </div>

        {/* Acreage Filter */}
        <div
          style={{
            marginBottom: "15px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            padding: "8px",
          }}
        >
          <label style={{ fontWeight: "bold" }}>Acreage Filter</label>
          <div style={{ marginTop: "8px" }}>
            <label>Min Acreage:</label>
            <input
              type="number"
              value={minAcreage}
              onChange={(e) => setMinAcreage(e.target.value)}
              style={{ width: "60px", marginLeft: "10px", marginRight: "20px" }}
            />
            <label>Max Acreage:</label>
            <input
              type="number"
              value={maxAcreage}
              onChange={(e) => setMaxAcreage(e.target.value)}
              style={{ width: "60px", marginLeft: "10px" }}
            />
          </div>
          <button
            onClick={applyAcreageFilter}
            style={{
              marginTop: "10px",
              padding: "6px 12px",
              background: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Apply Filter
          </button>
        </div>

        {/* Download Button */}
        <button
          onClick={downloadFilteredDataToExcel}
          style={{
            marginTop: "5px",
            padding: "8px 12px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Download Filtered Data (Excel)
        </button>
      </div>

      {/* The Map */}
      <MapContainer
        center={[41.2033, -77.1945]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ZipOverlay />

        <DrawHandler
          pricingData={pricingData}
          locations={locations}
          setFilteredPricingData={setFilteredPricingData}
          setFilteredLocations={setFilteredLocations}
        />

        {/* Markers from Main CSV */}
        {locations
          .filter(
            (loc) =>
              Number.isFinite(loc.coords[0]) && Number.isFinite(loc.coords[1])
          )
          .map((loc, index) => (
            <Marker key={index} position={loc.coords} icon={CustomMarkerIcon}>
              <Tooltip direction="top" offset={[0, -10]}>
                <div style={{ textAlign: "left" }}>
                  <strong>PRICE:</strong> {loc.details.PRICE}
                  <br />
                  <strong>ACRES:</strong> {loc.details.ACRES}
                </div>
              </Tooltip>
            </Marker>
          ))}

        {/* Markers from Pricing CSV */}
        {filteredPricingData
          .filter(
            (item) =>
              (item.coords &&
                Number.isFinite(item.coords[0]) &&
                Number.isFinite(item.coords[1])) ||
              (Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
          )
          .map((point, index) => (
            <Marker
              key={index}
              position={
                point.coords &&
                Number.isFinite(point.coords[0]) &&
                Number.isFinite(point.coords[1])
                  ? point.coords
                  : [point.latitude, point.longitude]
              }
              icon={DotIcon}
            >
              {point.lotAcreage !== null && (
                <Tooltip direction="top" offset={[0, -10]}>
                  <div>
                    <strong>LOT ACREAGE:</strong> {point.lotAcreage}
                  </div>
                </Tooltip>
              )}
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}

export default App;
