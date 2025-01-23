import React, { useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import * as XLSX from "xlsx"; // Import xlsx for Excel file creation
// import ZipOverlay from './components/ZipOverlay';

// Import your custom icons
import CustomMarkerIconImage from "./custom-marker.png"; // Ensure this is uploaded to your project
import DotIconImage from "./small-dot.png"; // Small dot icon

// Custom marker icon for Main CSV
const CustomMarkerIcon = L.icon({
  iconUrl: CustomMarkerIconImage,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

// Small dot marker icon for Pricing CSV
const DotIcon = L.icon({
  iconUrl: DotIconImage,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// -------------------------------------------------------------------------
// New ZipOverlay component that fetches and shows the PA ZIP code polygons
// -------------------------------------------------------------------------
function ZipOverlay() {
  const map = useMap();

  React.useEffect(() => {
    const url =
    'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/pa_pennsylvania_zip_codes_geo.min.json';
    // Fetch the remote GeoJSON file
    fetch(url)
      .then((res) => res.json())
      .then((geoData) => {
        // Create a Leaflet GeoJSON layer
        const layer = L.geoJSON(geoData, {
          style: {
            color: "#ff7800",
            weight: 1,
            fillColor: "#ffeda0",
            fillOpacity: 0.4,
          },
          onEachFeature: (feature, layerInstance) => {
            // Show ZIP code in popup
            const zip = feature.properties.ZCTA5CE10 || "Unknown ZIP";
            layerInstance.bindPopup(`ZIP Code: ${zip}`);
          },
        });
        layer.addTo(map);

        // If you want to auto-zoom to these polygons, uncomment:
        // map.fitBounds(layer.getBounds());
      })
      .catch((err) => {
        console.error("Error fetching ZIP code GeoJSON:", err);
      });
  }, [map]);

  return null;
}

// -------------------------------------------------------------
// Main App component (unchanged except we add <ZipOverlay />)
// -------------------------------------------------------------
function App() {
  const [locations, setLocations] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [filteredPricingData, setFilteredPricingData] = useState([]);
  const mapRef = useRef(null);

  // --- MAIN CSV UPLOAD ---
  const handleMainCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedData = results.data.map((row) => ({
          coords: [parseFloat(row.LATITUDE), parseFloat(row.LONGITUDE)],
          details: row,
        }));
        setLocations(parsedData);
      },
    });
  };

  // --- PRICING CSV UPLOAD ---
  const handlePricingCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const parsedData = results.data
          .filter(
            (row) =>
              row["LATITUDE"] && row["LONGITUDE"] && row["APN - FORMATTED"]
          )
          .map((row) => ({
            apn: row["APN - FORMATTED"],
            coords: [parseFloat(row.LATITUDE), parseFloat(row.LONGITUDE)],
            lotAcreage: row["LOT ACREAGE"]
              ? parseFloat(row["LOT ACREAGE"])
              : null,
          }));
        setPricingData(parsedData);
        setFilteredPricingData(parsedData);
      },
    });
  };

  // --- DRAW HANDLER ---
  const DrawHandler = () => {
    const map = useMapEvents({
      draw: {
        created: (e) => {
          const layer = e.layer;
          const drawnShape = layer.toGeoJSON();
          filterPricingData(drawnShape);
        },
      },
    });

    React.useEffect(() => {
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const drawControl = new L.Control.Draw({
        draw: {
          marker: false,
          polyline: false,
          circle: {
            shapeOptions: {
              color: "#ff0000",
            },
          },
          polygon: {
            shapeOptions: {
              color: "#0000ff",
            },
            showArea: true, // Show area of the polygon
          },
          rectangle: {
            shapeOptions: {
              color: "#00ff00",
            },
          },
        },
        edit: {
          featureGroup: drawnItems,
        },
      });

      map.addControl(drawControl);

      map.on("draw:created", (e) => {
        drawnItems.addLayer(e.layer);
        const drawnShape = e.layer.toGeoJSON();
        filterPricingData(drawnShape);
      });
    }, [map]);

    return null;
  };

  // --- FILTER PRICING DATA ---
  const filterPricingData = (shape) => {
    const polygonGeometry = polygon(shape.geometry.coordinates);

    const filteredPricing = pricingData.filter((pointData) => {
      const pointGeometry = point([pointData.coords[1], pointData.coords[0]]);
      return booleanPointInPolygon(pointGeometry, polygonGeometry);
    });

    const filteredLocations = locations.filter((loc) => {
      const pointGeometry = point([loc.coords[1], loc.coords[0]]);
      return booleanPointInPolygon(pointGeometry, polygonGeometry);
    });

    const combinedData = [
      ...filteredPricing.map((item) => ({
        type: "pricing",
        apn: item.apn,
        lotAcreage: item.lotAcreage,
        latitude: item.coords[0],
        longitude: item.coords[1],
      })),
      ...filteredLocations.map((item) => ({
        type: "comps",
        price: item.details.PRICE,
        acres: item.details.ACRES,
        latitude: item.coords[0],
        longitude: item.coords[1],
      })),
    ];

    setFilteredPricingData(combinedData);
  };

  // --- DOWNLOAD & EXPORT to Excel ---
  const downloadFilteredDataToExcel = () => {
    if (filteredPricingData.length === 0) {
      alert("No data points inside the drawn shape.");
      return;
    }

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

    // Remove filtered data from the map
    const filteredCoords = new Set(
      filteredPricingData.map((item) =>
        [item.latitude, item.longitude].join(",")
      )
    );

    setLocations((prevLocations) =>
      prevLocations.filter((loc) => !filteredCoords.has(loc.coords.join(",")))
    );

    setPricingData((prevPricingData) =>
      prevPricingData.filter(
        (point) => !filteredCoords.has(point.coords.join(","))
      )
    );

    // Clear filtered data
    setFilteredPricingData([]);

    alert("Filtered data downloaded and removed from the map.");
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      {/* Control Panel */}
      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          top: 10,
          right: 10,
          background: "white",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        }}
      >
        <div>
          <label>
            Upload Main CSV:{" "}
            <input
              type="file"
              accept=".csv"
              onChange={handleMainCSVUpload}
              style={{ display: "block", marginBottom: "10px" }}
            />
          </label>
        </div>
        <div>
          <label>
            Upload Pricing CSV:{" "}
            <input
              type="file"
              accept=".csv"
              onChange={handlePricingCSVUpload}
              style={{ display: "block", marginBottom: "10px" }}
            />
          </label>
        </div>

        <button
          onClick={downloadFilteredDataToExcel}
          style={{
            marginTop: "10px",
            padding: "5px 10px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
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

        {/* Add the zip code overlay */}
        <ZipOverlay />

        {/* Draw tools */}
        <DrawHandler />

        {/* Markers from CSVs */}
        {locations.map((loc, index) => (
          <Marker key={index} position={loc.coords} icon={CustomMarkerIcon}>
            <Tooltip direction="top" offset={[0, -10]} permanent>
              <div style={{ textAlign: "left" }}>
                <strong>PRICE:</strong> {loc.details.PRICE}
                <br />
                <strong>ACRES:</strong> {loc.details.ACRES}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {pricingData.map((point, index) => (
          <Marker key={index} position={point.coords} icon={DotIcon}></Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;
