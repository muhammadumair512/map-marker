// loaded and shown as clusters and ok message beneth the upload btns once file is fully uploaded
// this one is fast, it uploads the points faster
// App.jsx
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
import MarkerClusterGroup from "react-leaflet-cluster";

// Custom icons
import CustomMarkerIconImage from "./custom-marker.png";
import DotIconImage from "./small-dot.png";

const CustomMarkerIcon = L.icon({
  iconUrl: CustomMarkerIconImage,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});
const DotIcon = L.icon({
  iconUrl: DotIconImage,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// ----- State dropdown data remains the same -----
const states = [
  { name: "Pennsylvania", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/pa_pennsylvania_zip_codes_geo.min.json" },
  { name: "Alabama", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/al_alabama_zip_codes_geo.min.json" },
  { name: "Alaska", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ak_alaska_zip_codes_geo.min.json" },
  { name: "Arizona", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/az_arizona_zip_codes_geo.min.json" },
  { name: "Arkansas", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ar_arkansas_zip_codes_geo.min.json" },
  { name: "California", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ca_california_zip_codes_geo.min.json" },
  { name: "Colorado", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/co_colorado_zip_codes_geo.min.json" },
  { name: "Connecticut", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ct_connecticut_zip_codes_geo.min.json" },
  { name: "Delaware", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/de_delaware_zip_codes_geo.min.json" },
  { name: "District of Columbia", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/dc_district_of_columbia_zip_codes_geo.min.json" },
  { name: "Florida", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/fl_florida_zip_codes_geo.min.json" },
  { name: "Georgia", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ga_georgia_zip_codes_geo.min.json" },
  { name: "Hawaii", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/hi_hawaii_zip_codes_geo.min.json" },
  { name: "Idaho", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/id_idaho_zip_codes_geo.min.json" },
  { name: "Illinois", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/il_illinois_zip_codes_geo.min.json" },
  { name: "Indiana", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/in_indiana_zip_codes_geo.min.json" },
  { name: "Iowa", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ia_iowa_zip_codes_geo.min.json" },
  { name: "Kansas", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ks_kansas_zip_codes_geo.min.json" },
  { name: "Kentucky", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ky_kentucky_zip_codes_geo.min.json" },
  { name: "Louisiana", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/la_louisiana_zip_codes_geo.min.json" },
  { name: "Maine", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/me_maine_zip_codes_geo.min.json" },
  { name: "Maryland", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/md_maryland_zip_codes_geo.min.json" },
  { name: "Massachusetts", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ma_massachusetts_zip_codes_geo.min.json" },
  { name: "Michigan", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/mi_michigan_zip_codes_geo.min.json" },
  { name: "Minnesota", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/mn_minnesota_zip_codes_geo.min.json" },
  { name: "Mississippi", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ms_mississippi_zip_codes_geo.min.json" },
  { name: "Missouri", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/mo_missouri_zip_codes_geo.min.json" },
  { name: "Montana", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/mt_montana_zip_codes_geo.min.json" },
  { name: "Nebraska", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ne_nebraska_zip_codes_geo.min.json" },
  { name: "Nevada", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nv_nevada_zip_codes_geo.min.json" },
  { name: "New Hampshire", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nh_new_hampshire_zip_codes_geo.min.json" },
  { name: "New Jersey", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nj_new_jersey_zip_codes_geo.min.json" },
  { name: "New Mexico", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nm_new_mexico_zip_codes_geo.min.json" },
  { name: "New York", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ny_new_york_zip_codes_geo.min.json" },
  { name: "North Carolina", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nc_north_carolina_zip_codes_geo.min.json" },
  { name: "North Dakota", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/nd_north_dakota_zip_codes_geo.min.json" },
  { name: "Ohio", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/oh_ohio_zip_codes_geo.min.json" },
  { name: "Oklahoma", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ok_oklahoma_zip_codes_geo.min.json" },
  { name: "Oregon", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/or_oregon_zip_codes_geo.min.json" },
  { name: "Rhode Island", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ri_rhode_island_zip_codes_geo.min.json" },
  { name: "South Carolina", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/sc_south_carolina_zip_codes_geo.min.json" },
  { name: "South Dakota", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/sd_south_dakota_zip_codes_geo.min.json" },
  { name: "Tennessee", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/tn_tennessee_zip_codes_geo.min.json" },
  { name: "Texas", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/tx_texas_zip_codes_geo.min.json" },
  { name: "Utah", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/ut_utah_zip_codes_geo.min.json" },
  { name: "Vermont", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/vt_vermont_zip_codes_geo.min.json" },
  { name: "Virginia", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/va_virginia_zip_codes_geo.min.json" },
  { name: "Washington", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/wa_washington_zip_codes_geo.min.json" },
  { name: "West Virginia", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/wv_west_virginia_zip_codes_geo.min.json" },
  { name: "Wisconsin", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/wi_wisconsin_zip_codes_geo.min.json" },
  { name: "Wyoming", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/wy_wyoming_zip_codes_geo.min.json" },
];

// ----------------------------------
// ZipOverlay – unchanged
// ----------------------------------
function ZipOverlay({ zipUrl }) {
  const map = useMap();
  const layersCache = useRef({});

  useEffect(() => {
    if (!zipUrl) return;
    Object.values(layersCache.current).forEach((layer) => map.removeLayer(layer));
    let currentLayer;

    if (layersCache.current[zipUrl]) {
      currentLayer = layersCache.current[zipUrl];
      currentLayer.addTo(map);
    } else {
      fetch(zipUrl)
        .then((res) => res.json())
        .then((geoData) => {
          currentLayer = L.geoJSON(geoData, {
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
          layersCache.current[zipUrl] = currentLayer;
          currentLayer.addTo(map);
        })
        .catch((err) => console.error("Error fetching ZIP code GeoJSON:", err));
    }

    return () => {
      if (currentLayer) map.removeLayer(currentLayer);
    };
  }, [map, zipUrl]);

  return null;
}

// ----------------------------------
// DrawHandler – unchanged (just shortened comments)
// ----------------------------------
function DrawHandler({
  setShapeFilteredData,
  pricingDataRef,
  locationsRef,
  setDeleteFunction,
  acreageFilteredDataRef,
}) {
  const map = useMap();
  const [controlAdded, setControlAdded] = useState(false);
  const drawnItemsRef = useRef(null);
  const shapesArrayRef = useRef([]);
  const selectedShapeRef = useRef(null);

  const isPointInShape = (lat, lng, layer) => {
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      return map.distance(center, L.latLng(lat, lng)) <= radius;
    }
    const shapeGeoJSON = layer.toGeoJSON();
    const polygonGeometry = polygon(shapeGeoJSON.geometry.coordinates);
    return booleanPointInPolygon(point([lng, lat]), polygonGeometry);
  };

  const handleShapeDrawn = (layer) => {
    shapesArrayRef.current.push(layer);
    layer.on("click", () => {
      selectedShapeRef.current = layer;
    });

    // Use filtered data if available, else entire pricing data
    const currentPricingData = acreageFilteredDataRef.current.length
      ? acreageFilteredDataRef.current
      : pricingDataRef.current;

    const filteredPricing = currentPricingData.filter((p) => {
      const [lat, lng] = p.coords;
      return isPointInShape(lat, lng, layer);
    });

    const filteredComps = locationsRef.current.filter((loc) => {
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

    setShapeFilteredData(combinedData);
    console.log("Shape Filtered Data:", combinedData);
  };

  useEffect(() => {
    if (!controlAdded) {
      const drawnItems = new L.FeatureGroup();
      drawnItemsRef.current = drawnItems;
      map.addLayer(drawnItems);
      const drawControl = new L.Control.Draw({
        draw: {
          marker: false,
          polyline: false,
          circle: { shapeOptions: { color: "#ff0000" }, showRadius: true },
          circlemarker: false,
          polygon: { shapeOptions: { color: "#0000ff" }, showArea: true },
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

      setDeleteFunction(() => {
        if (selectedShapeRef.current && drawnItemsRef.current) {
          drawnItemsRef.current.removeLayer(selectedShapeRef.current);
          shapesArrayRef.current = shapesArrayRef.current.filter(
            (shape) => shape !== selectedShapeRef.current
          );
          selectedShapeRef.current = null;
        } else if (shapesArrayRef.current.length > 0) {
          const lastShape = shapesArrayRef.current.pop();
          if (lastShape && drawnItemsRef.current) {
            drawnItemsRef.current.removeLayer(lastShape);
          }
        }
      });
    }
  }, [
    map,
    controlAdded,
    pricingDataRef,
    locationsRef,
    setShapeFilteredData,
    setDeleteFunction,
    acreageFilteredDataRef,
  ]);

  return null;
}

// ----------------------------------
// App
// ----------------------------------
function App() {
  const [selectedStateUrl, setSelectedStateUrl] = useState(states[0].url);
  const [locations, setLocations] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [shapeFilteredData, setShapeFilteredData] = useState([]);
  const [acreageFilteredData, setAcreageFilteredData] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");

  // For progress bars
  const [mainCSVProgress, setMainCSVProgress] = useState(0);
  const [pricingCSVProgress, setPricingCSVProgress] = useState(0);

  // Refs
  const pricingDataRef = useRef(pricingData);
  const locationsRef = useRef(locations);
  const acreageFilteredDataRef = useRef(acreageFilteredData);

  const mapRef = useRef(null);
  const deleteLastShapeRef = useRef(() => {});

  // Keep references in sync
  useEffect(() => {
    pricingDataRef.current = pricingData;
  }, [pricingData]);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);
  useEffect(() => {
    acreageFilteredDataRef.current = acreageFilteredData;
  }, [acreageFilteredData]);

  // ----------------------------------
  // Generic CSV parse with progress
  // ----------------------------------
  const parseCSVWithProgress = (file, onRowParsed, onComplete, onProgress) => {
    // 1) First read the entire file as text to estimate #lines (minus header).
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const allLines = text.split(/\r\n|\n|\r/);
      // Some CSVs have a header, so let's subtract 1 for the header row:
      const totalRows = Math.max(allLines.length - 1, 1);

      let parsedRows = 0;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true, // parse in a Web Worker
        step: (results, parser) => {
          // Called each time a row is parsed
          const row = results.data;
          // We can skip empty or invalid rows here if needed
          if (row && Object.keys(row).length > 0) {
            onRowParsed(row);
          }
          parsedRows++;
          const percent = Math.min(100, (parsedRows / totalRows) * 100);
          onProgress(percent);

          // If all rows are parsed, we can stop (Papa sometimes calls step for the last "empty" row)
          if (parsedRows >= totalRows) {
            parser.abort();
          }
        },
        complete: () => {
          onComplete();
        },
        error: (err) => {
          console.error("PapaParse Error:", err);
        },
      });
    };
    reader.readAsText(file);
  };

  // ----------------------------------
  // Handle Main CSV
  // ----------------------------------
  const handleMainCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setMainCSVProgress(0);

    parseCSVWithProgress(
      file,
      (row) => {
        // Each valid row -> add to locations
        const lat = parseFloat(row.LATITUDE);
        const lng = parseFloat(row.LONGITUDE);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLocations((prev) => [
            ...prev,
            { coords: [lat, lng], details: row },
          ]);
        }
      },
      () => console.log("Main CSV done parsing."),
      (progressPct) => setMainCSVProgress(progressPct)
    );
  };

  // ----------------------------------
  // Handle Pricing CSV
  // ----------------------------------
  const handlePricingCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setPricingCSVProgress(0);

    parseCSVWithProgress(
      file,
      (row) => {
        const lat = parseFloat(row.LATITUDE);
        const lng = parseFloat(row.LONGITUDE);
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          row["APN - FORMATTED"]
        ) {
          setPricingData((prev) => [
            ...prev,
            {
              apn: row["APN - FORMATTED"],
              coords: [lat, lng],
              lotAcreage: row["LOT ACREAGE"]
                ? parseFloat(row["LOT ACREAGE"])
                : null,
            },
          ]);
        }
      },
      () => console.log("Pricing CSV done parsing."),
      (progressPct) => setPricingCSVProgress(progressPct)
    );
  };

  // ----------------------------------
  // Acreage filter + shape filter logic
  // ----------------------------------
  const applyAcreageFilter = () => {
    const minVal = parseFloat(minAcreage);
    const maxVal = parseFloat(maxAcreage);
    if (isNaN(minVal) || isNaN(maxVal)) {
      alert("Please enter valid numeric values for both min and max acreage.");
      return;
    }
    const filtered = pricingData.filter((pd) => {
      if (pd.lotAcreage == null) return false;
      return pd.lotAcreage >= minVal && pd.lotAcreage <= maxVal;
    });
    setAcreageFilteredData(filtered);
  };

  const clearFilters = () => {
    setShapeFilteredData([]);
    setAcreageFilteredData([]);
    setMinAcreage("");
    setMaxAcreage("");
  };

  const downloadFilteredDataToExcel = () => {
    const filteredPricingData = shapeFilteredData.filter(
      (item) => item.type === "pricing"
    );
    if (filteredPricingData.length === 0) {
      alert("No data points within the drawn shape to download.");
      return;
    }

    const pricingDataTab = filteredPricingData.map((item) => ({
      APN: item.apn,
      "LOT ACREAGE": item.lotAcreage,
      Latitude: item.latitude,
      Longitude: item.longitude,
    }));

    const workbook = XLSX.utils.book_new();
    const pricingSheet = XLSX.utils.json_to_sheet(pricingDataTab);
    XLSX.utils.book_append_sheet(workbook, pricingSheet, "Pricing Data");
    XLSX.writeFile(workbook, "filtered_data.xlsx");

    // Remove exported APNs from the map data
    const exportedAPNs = new Set(filteredPricingData.map((item) => item.apn));
    setLocations((prev) =>
      prev.filter((loc) => !exportedAPNs.has(loc.details["APN - FORMATTED"]))
    );
    setPricingData((prev) => prev.filter((pt) => !exportedAPNs.has(pt.apn)));

    // Clear shape and acreage filters
    setShapeFilteredData([]);
    setAcreageFilteredData([]);

    alert("Filtered data downloaded and removed from the map.");
  };

  // Decide which pricing markers to display
  const markersToDisplay = acreageFilteredData.length
    ? acreageFilteredData
    : pricingData;

  // ----------------------------------
  // UI for progress bars
  // ----------------------------------
  const ProgressBar = ({ progress }) => {
    return (
      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#e0e0e0",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress.toFixed(1)}%`,
              height: "100%",
              background: "#28a745",
              transition: "width 0.2s",
            }}
          />
        </div>
        <small style={{ color: "#555" }}>{progress.toFixed(1)}%</small>
      </div>
    );
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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <StateDropdown
          states={states}
          selectedStateUrl={selectedStateUrl}
          onSelect={(url) => setSelectedStateUrl(url)}
        />
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
            style={{
              width: "100%",
              marginTop: "5px",
              padding: "6px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          />
          {/* Progress bar for main CSV */}
          {mainCSVProgress > 0 && mainCSVProgress < 100 && (
            <ProgressBar progress={mainCSVProgress} />
          )}
          {mainCSVProgress === 100 && (
            <small style={{ color: "green" }}>Main CSV Loaded!</small>
          )}
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
            style={{
              width: "100%",
              marginTop: "5px",
              padding: "6px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          />
          {/* Progress bar for pricing CSV */}
          {pricingCSVProgress > 0 && pricingCSVProgress < 100 && (
            <ProgressBar progress={pricingCSVProgress} />
          )}
          {pricingCSVProgress === 100 && (
            <small style={{ color: "green" }}>Pricing CSV Loaded!</small>
          )}
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
            <div style={{ marginBottom: "4px" }}>
              <label>Min Acreage:</label>
              <input
                type="number"
                value={minAcreage}
                onChange={(e) => setMinAcreage(e.target.value)}
                style={{
                  width: "60px",
                  marginLeft: "15px",
                  padding: "2px 4px",
                }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label>Max Acreage:</label>
              <input
                type="number"
                value={maxAcreage}
                onChange={(e) => setMaxAcreage(e.target.value)}
                style={{
                  width: "60px",
                  marginLeft: "10px",
                  padding: "2px 4px",
                }}
              />
            </div>
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
          <button
            onClick={clearFilters}
            style={{
              marginTop: "10px",
              marginLeft: "10px",
              padding: "6px 12px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear Filter
          </button>
        </div>

        {/* Download Filtered Data */}
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

        {/* Delete shape */}
        <button
          onClick={() => deleteLastShapeRef.current()}
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            background: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          🗑️ Delete Selected Shape
        </button>
      </div>

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
        <ZipOverlay zipUrl={selectedStateUrl} />
        <DrawHandler
          setShapeFilteredData={setShapeFilteredData}
          pricingDataRef={pricingDataRef}
          locationsRef={locationsRef}
          acreageFilteredDataRef={acreageFilteredDataRef}
          setDeleteFunction={(fn) => {
            deleteLastShapeRef.current = fn;
          }}
        />

        {/* Main CSV (comps) markers in a cluster */}
        <MarkerClusterGroup chunkedLoading>
          {locations
            .filter(
              (loc) =>
                Number.isFinite(loc.coords[0]) &&
                Number.isFinite(loc.coords[1])
            )
            .map((loc, index) => (
              <Marker
                key={`main-${index}`}
                position={loc.coords}
                icon={CustomMarkerIcon}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div style={{ textAlign: "left" }}>
                    <strong>PRICE:</strong> {loc.details.PRICE}
                    <br />
                    <strong>ACRES:</strong> {loc.details.ACRES}
                  </div>
                </Tooltip>
              </Marker>
            ))}
        </MarkerClusterGroup>

        {/* Pricing CSV markers in a cluster */}
        <MarkerClusterGroup chunkedLoading>
          {markersToDisplay
            .filter((item) => {
              const [lat, lng] = item.coords || [item.latitude, item.longitude];
              return Number.isFinite(lat) && Number.isFinite(lng);
            })
            .map((point, index) => {
              const [lat, lng] =
                point.coords || [point.latitude, point.longitude];
              return (
                <Marker
                  key={`pricing-${index}`}
                  position={[lat, lng]}
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
              );
            })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

// ----------------------------------
// StateDropdown – unchanged
// ----------------------------------
function StateDropdown({ states, selectedStateUrl, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toggleOpen = () => setOpen(!open);

  const filteredStates = states.filter((st) =>
    st.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: "relative", marginBottom: "10px" }}>
      <div
        onClick={toggleOpen}
        style={{
          padding: "6px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
          background: "#fff",
        }}
      >
        {states.find((s) => s.url === selectedStateUrl)?.name ||
          "Select State"}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1001,
          }}
        >
          <input
            type="text"
            placeholder="Search state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
          />
          {filteredStates.map((st) => (
            <div
              key={st.name}
              onClick={() => {
                onSelect(st.url);
                setOpen(false);
                setSearch("");
              }}
              style={{
                padding: "6px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
              }}
            >
              {st.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
