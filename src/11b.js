// loads all points at once in combined bubble and its fast!

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

// Marker clustering
import MarkerClusterGroup from "react-leaflet-cluster";

// Custom icons
import CustomMarkerIconImage from "./custom-marker.png";
import DotIconImage from "./small-dot.png";

// Define your marker icons
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

// Example states
const states = [
  { name: "Pennsylvania", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/pa_pennsylvania_zip_codes_geo.min.json" },
  { name: "Alabama", url: "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/refs/heads/master/al_alabama_zip_codes_geo.min.json" },
  // ... all other states ...
];

// ---------------------------------------------------------------------------
// 1) ZIP Overlay (unchanged)
// ---------------------------------------------------------------------------
function ZipOverlay({ zipUrl }) {
  const map = useMap();
  const layersCache = useRef({});

  useEffect(() => {
    if (!zipUrl) return;

    // Remove old layers
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

// ---------------------------------------------------------------------------
// 2) DrawHandler for shape drawing (unchanged except minimal comments)
// ---------------------------------------------------------------------------
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

    // If acreage is filtered, use acreageFilteredData; else use full pricingData
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
  };

  // Add the draw control once
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

      // Let user delete last shape
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

// ---------------------------------------------------------------------------
// 3) Main App
// ---------------------------------------------------------------------------
function App() {
  const [selectedStateUrl, setSelectedStateUrl] = useState(states[0].url);
  const [locations, setLocations] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [shapeFilteredData, setShapeFilteredData] = useState([]);
  const [acreageFilteredData, setAcreageFilteredData] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");

  // Track upload progress (in %)
  const [mainCSVProgress, setMainCSVProgress] = useState(0);
  const [pricingCSVProgress, setPricingCSVProgress] = useState(0);

  // Refs
  const pricingDataRef = useRef(pricingData);
  const locationsRef = useRef(locations);
  const acreageFilteredDataRef = useRef(acreageFilteredData);

  const mapRef = useRef(null);
  const deleteLastShapeRef = useRef(() => {});

  // Keep data references in sync
  useEffect(() => {
    pricingDataRef.current = pricingData;
  }, [pricingData]);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);
  useEffect(() => {
    acreageFilteredDataRef.current = acreageFilteredData;
  }, [acreageFilteredData]);

  // -------------------------------------------------
  // Utility: Parse CSV with row-by-row progress
  // -------------------------------------------------
  const parseCSVWithProgress = (
    file,
    onRowParsed,
    onComplete,
    setProgress // function to update progress
  ) => {
    // 1) Read entire file as text to estimate #lines
    const reader = new FileReader();
    reader.onload = (e) => {
      // approximate total lines
      const text = e.target.result;
      const allLines = text.split(/\r\n|\n|\r/);
      const totalRows = Math.max(allLines.length - 1, 1); // subtract 1 for header row

      let parsedRows = 0;

      // 2) Parse in step mode with a web worker
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        step: (results, parser) => {
          const row = results.data;
          if (row && Object.keys(row).length > 0) {
            onRowParsed(row);
          }

          parsedRows++;
          const pct = Math.min(100, (parsedRows / totalRows) * 100);
          setProgress(pct);

          if (parsedRows >= totalRows) {
            parser.abort(); // stop parsing leftover blank lines
          }
        },
        complete: onComplete,
        error: (err) => console.error("PapaParse Error:", err),
      });
    };

    reader.readAsText(file);
  };

  // -------------------------------------------------
  // Handlers: CSV Upload
  // -------------------------------------------------
  const handleMainCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setMainCSVProgress(0); // show progress bar from 0 to 100

    parseCSVWithProgress(
      file,
      (row) => {
        // Each valid row => push to 'locations'
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
      setMainCSVProgress // we pass the function to update progress
    );
  };

  const handlePricingCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setPricingCSVProgress(0);

    parseCSVWithProgress(
      file,
      (row) => {
        const lat = parseFloat(row.LATITUDE);
        const lng = parseFloat(row.LONGITUDE);
        if (Number.isFinite(lat) && Number.isFinite(lng) && row["APN - FORMATTED"]) {
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
      setPricingCSVProgress
    );
  };

  // -------------------------------------------------
  // Acreage Filters
  // -------------------------------------------------
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

  // -------------------------------------------------
  // Download filtered data
  // -------------------------------------------------
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

    // remove exported points from map
    const exportedAPNs = new Set(filteredPricingData.map((item) => item.apn));
    setLocations((prev) =>
      prev.filter((loc) => !exportedAPNs.has(loc.details["APN - FORMATTED"]))
    );
    setPricingData((prev) => prev.filter((pt) => !exportedAPNs.has(pt.apn)));

    // clear shape and acreage filters
    setShapeFilteredData([]);
    setAcreageFilteredData([]);

    alert("Filtered data downloaded and removed from the map.");
  };

  // Which pricing markers to display
  const markersToDisplay = acreageFilteredData.length
    ? acreageFilteredData
    : pricingData;

  // -------------------------------------------------
  // ProgressBar component
  // -------------------------------------------------
  const ProgressBar = ({ progress }) => {
    if (progress <= 0 || progress >= 100) return null; // hide if not active or done

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
              background: "linear-gradient(to right, #00c6ff, #0072ff)",
              transition: "width 0.2s",
            }}
          />
        </div>
        <small style={{ color: "#555" }}>
          {progress.toFixed(1)}% loaded...
        </small>
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      {/* ====== Control Panel ====== */}
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
          {/* Show progress while (0,100) */}
          <ProgressBar progress={mainCSVProgress} />
          {/* Show a "Done!" if exactly 100 */}
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
          <ProgressBar progress={pricingCSVProgress} />
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

        {/* Download button */}
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

      {/* ====== Map ====== */}
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

        {/* Main CSV points in cluster */}
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

        {/* Pricing CSV points in cluster */}
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

// ---------------------------------------------------------------------------
// 4) StateDropdown – unchanged, just simple UI
// ---------------------------------------------------------------------------
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
