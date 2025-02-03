import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  Suspense,
  memo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import simplify from "@turf/simplify";
import * as XLSX from "xlsx";
import { quadtree } from "d3-quadtree";

// Custom icons for Main CSV markers
import CustomMarkerIconImage from "./custom-marker.png";

const CustomMarkerIcon = L.icon({
  iconUrl: CustomMarkerIconImage,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

// Global cache for ZIP overlays and resource caching
const zipOverlayCache = {};
const zipOverlayResourceCache = {};

// Helper to wrap a promise for Suspense
function wrapPromise(promise) {
  let status = "pending";
  let result;
  let suspender = promise.then(
    (r) => {
      status = "success";
      result = r;
    },
    (e) => {
      status = "error";
      result = e;
    }
  );
  return {
    read() {
      if (status === "pending") throw suspender;
      if (status === "error") throw result;
      return result;
    },
  };
}

// Helper function to create a ZIP overlay from GeoJSON
const createZipOverlay = (geoData) => {
  return L.geoJSON(geoData, {
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
};

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

/* ----------------------------
   Global CSS
----------------------------- */
const globalStyles = `
/* Desktop Control Panel Style */
.control-panel {
  position: absolute;
  z-index: 1000;
  top: 10px;
  right: 10px;
  width: 250px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-family: 'Arial', sans-serif;
  color: #000;
  text-align: center;
}

/* Headings */
.control-panel h3 {
  font-size: 24px;
  margin: 0 0 10px 0;
}
.control-panel h4 {
  font-size: 18px;
  margin: 10px 0;
}

/* Upload Button & Hidden Input */
.hidden-input {
  display: none;
}
.upload-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  justify-content: center;
}
.upload-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.uploaded-text {
  font-size: 14px;
  margin-top: 5px;
  color: green;
}

/* Acreage Filter Styles */
.acreage-container {
  margin-bottom: 10px;
  text-align: left;
}
.acreage-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
}
.acreage-row label {
  margin-right: 10px;
  min-width: 90px;
}
.acreage-input {
  width: 80px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.acreage-buttons {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  }
  
  /* Action Buttons */
.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  justify-content: center;
}

/* Button Styles */
button {
  padding: 8px 12px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: background 0.3s ease;
  font-size: 16px;
}
.btn-primary {
  background: linear-gradient(145deg, #3b8dff, #0052d4);
  color: white;
}
.btn-primary:hover {
  background: linear-gradient(145deg, #0052d4, #3b8dff);
}
.btn-danger {
  background: linear-gradient(145deg,rgb(249, 4, 4), #ff4b2b);
  color: white;
}
.btn-danger:hover {
  background: linear-gradient(145deg,rgb(150, 26, 4), #ff416c);
}
  .btn-green {
  background: linear-gradient(145deg,rgb(16, 86, 16),rgb(78, 179, 98));
  color: white;
}
.btn-green:hover {
  background: linear-gradient(145deg,rgb(78, 179, 98),rgb(16, 86, 16));
}
.btn-clear {
  background: #283593;
  color: white;
}
.btn-clear:hover {
  background: #1e256d;
}

/* Hamburger Button (Mobile Only) */
.hamburger-button {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1100;
  background: #3b8dff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px;
  font-size: 20px;
  cursor: pointer;
}

/* Close Button inside Mobile Panel */
.close-button {
  position: absolute;
  top: 5px;
  right: 5px;
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

/* Mobile Layout */
@media (max-width: 768px) {
  .control-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    left: auto;
    width: 70%;
    max-height: none;
    overflow: visible;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .dropdown-container,
  .upload-row,
  .acreage-container,
  .action-buttons {
    margin-bottom: 10px;
  }
}
`;

if (typeof document !== "undefined") {
  const styleTag = document.createElement("style");
  styleTag.innerText = globalStyles;
  document.head.appendChild(styleTag);
}

/* ------------------------------------------------------------------
   ZIP Overlay Component (using Suspense)
------------------------------------------------------------------- */
function ZipOverlay({ zipUrl }) {
  const map = useMap();

  const overlayResource = useMemo(() => {
    if (!zipUrl) return null;
    if (zipOverlayCache[zipUrl]) {
      return { read: () => zipOverlayCache[zipUrl] };
    }
    if (zipOverlayResourceCache[zipUrl]) return zipOverlayResourceCache[zipUrl];

    const promise = fetch(zipUrl)
      .then((res) => res.json())
      .then((geoData) => {
        const simplifiedGeoData = simplify(geoData, {
          tolerance: 0.01,
          highQuality: false,
        });
        const overlay = createZipOverlay(simplifiedGeoData);
        zipOverlayCache[zipUrl] = overlay;
        return overlay;
      })
      .catch((err) => {
        console.error("Error fetching ZIP code GeoJSON:", err);
        throw err;
      });
    const res = wrapPromise(promise);
    zipOverlayResourceCache[zipUrl] = res;
    return res;
  }, [zipUrl]);

  const overlay = overlayResource ? overlayResource.read() : null;

  useEffect(() => {
    if (!overlay) return;
    Object.values(zipOverlayCache).forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    overlay.addTo(map);
    if (overlay.getBounds && overlay.getBounds().isValid()) {
      map.fitBounds(overlay.getBounds());
    }
    return () => {
      if (overlay && map.hasLayer(overlay)) {
        map.removeLayer(overlay);
      }
    };
  }, [map, overlay]);

  return null;
}

/* ------------------------------------------------------------------
   DrawHandler Component (unchanged logic)
------------------------------------------------------------------- */
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
          circle: {
            shapeOptions: { color: "#ff0000", pane: "overlayPane" },
            showRadius: true,
          },
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

/* ------------------------------------------------------------------
   Custom hook: useVisiblePricingPoints
   Filters pricing data based on current map bounds (using a quadtree for speed)
------------------------------------------------------------------- */
function useVisiblePricingPoints(pricingData, acreageFilteredData) {
  const map = useMap();
  const [visiblePoints, setVisiblePoints] = useState([]);
  const quadtreeRef = useRef(null);

  useEffect(() => {
    if (!acreageFilteredData.length && pricingData.length) {
      quadtreeRef.current = quadtree()
        .x((d) => d.coords[1])
        .y((d) => d.coords[0])
        .addAll(pricingData);
    }
  }, [pricingData, acreageFilteredData]);

  useEffect(() => {
    if (!map) return;
    const updateVisible = () => {
      const zoom = map.getZoom();
      const buffer = zoom < 8 ? 0.5 : zoom < 10 ? 0.2 : zoom < 12 ? 0.1 : zoom < 14 ? 0.05 : 0.02;
      const bounds = map.getBounds();
      const north = bounds.getNorth() + buffer;
      const south = bounds.getSouth() - buffer;
      const east = bounds.getEast() + buffer;
      const west = bounds.getWest() - buffer;
      let points = [];

      if (quadtreeRef.current) {
        quadtreeRef.current.visit((node, x0, y0, x1, y1) => {
          if (x0 > east || x1 < west || y0 > north || y1 < south) {
            return true;
          }
          if (!node.length) {
            let d = node.data;
            if (d) {
              const lat = d.coords[0],
                lng = d.coords[1];
              if (lat >= south && lat <= north && lng >= west && lng <= east) {
                points.push(d);
              }
            }
          }
          return false;
        });
      } else {
        points = pricingData.filter((d) => {
          const lat = d.coords[0],
            lng = d.coords[1];
          return lat >= south && lat <= north && lng >= west && lng <= east;
        });
      }
      setVisiblePoints(points);
    };

    updateVisible();
    map.on("moveend zoomend", updateVisible);
    return () => {
      map.off("moveend zoomend", updateVisible);
    };
  }, [map, pricingData]);

  return visiblePoints;
}

/* ------------------------------------------------------------------
   Component to render pricing points using CircleMarkers
   These markers are drawn via canvas (since preferCanvas is enabled) and
   show a tooltip with the acreage on hover.
------------------------------------------------------------------- */
const VisiblePricingCircleMarkers = memo(function VisiblePricingCircleMarkers({
  pricingData,
  acreageFilteredData,
}) {
  const visiblePoints =
    acreageFilteredData.length > 0
      ? acreageFilteredData
      : useVisiblePricingPoints(pricingData, acreageFilteredData);
  return visiblePoints
    .filter(
      (point) =>
        Number.isFinite(point.coords[0]) &&
        Number.isFinite(point.coords[1])
    )
    .map((point, index) => {
      return (
        <CircleMarker
          key={`pricing-${index}`}
          center={[point.coords[0], point.coords[1]]}
          radius={3}
          fillColor="green"
          // stroke={false}
          interactive={true}
           // added
           color="green"  // Added border color
           stroke={true}  // Enable border
           fillOpacity={0.7}  // Added fill opacity (0.7 means 70% opaque)
           weight={1}  // Border width
        >
          {point.lotAcreage !== null && (
            <Tooltip direction="top" offset={[0, -10]}>
              <div>
                <strong>LOT ACREAGE:</strong> {point.lotAcreage}
              </div>
            </Tooltip>
          )}
        </CircleMarker>
      );
    });
});

/* ------------------------------------------------------------------
   Main App Component
------------------------------------------------------------------- */
function App() {
  // Global unhandled promise rejection listener.
  useEffect(() => {
    const handler = (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  const [selectedStateUrl, setSelectedStateUrl] = useState(null);
  const [locations, setLocations] = useState([]);
  const [pricingData, setPricingData] = useState([]);
  const [shapeFilteredData, setShapeFilteredData] = useState([]);
  const [acreageFilteredData, setAcreageFilteredData] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [mainUploaded, setMainUploaded] = useState(false);
  const [pricingUploaded, setPricingUploaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showControlPanel, setShowControlPanel] = useState(!isMobile);

  const pricingDataRef = useRef(pricingData);
  const locationsRef = useRef(locations);
  const acreageFilteredDataRef = useRef(acreageFilteredData);
  const mapRef = useRef(null);
  const deleteLastShapeRef = useRef(() => {});

  const mainInputRef = useRef(null);
  const pricingInputRef = useRef(null);

  useEffect(() => {
    pricingDataRef.current = pricingData;
  }, [pricingData]);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);
  useEffect(() => {
    acreageFilteredDataRef.current = acreageFilteredData;
  }, [acreageFilteredData]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowControlPanel(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Pre-cache ZIP overlays for states not currently selected.
  useEffect(() => {
    states.forEach((st) => {
      if (st.url !== selectedStateUrl && !zipOverlayCache[st.url]) {
        fetch(st.url)
          .then((res) => res.json())
          .then((geoData) => {
            const simplifiedGeoData = simplify(geoData, {
              tolerance: 0.01,
              highQuality: false,
            });
            const overlay = createZipOverlay(simplifiedGeoData);
            zipOverlayCache[st.url] = overlay;
          })
          .catch((err) =>
            console.error(
              "Error pre-caching ZIP overlay for state:",
              st.name,
              err
            )
          );
      }
    });
  }, [selectedStateUrl]);

  const handleMainCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        try {
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
          setMainUploaded(true);
        } catch (err) {
          console.error("Error processing Main CSV:", err);
        }
      },
      error: (err) => console.error("PapaParse Error (Main CSV):", err),
    });
  };

  const handlePricingCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    let pricingCache = [];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      chunkSize: 1500000,
      chunk: (results) => {
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
        pricingCache.push(...chunkData);
      },
      complete: () => {
        setPricingData(pricingCache);
        pricingDataRef.current = pricingCache;
        setPricingUploaded(true);
        console.log("Pricing CSV parsing complete!");
      },
      error: (err) =>
        console.error("PapaParse Error (Pricing CSV):", err),
    });
  };

  const applyAcreageFilter = () => {
    const minVal = parseFloat(minAcreage);
    const maxVal = parseFloat(maxAcreage);
    if (isNaN(minVal) || isNaN(maxVal)) {
      alert("Please enter valid numeric values for both min and max acreage.");
/*************  ✨ Codeium Command ⭐  *************/
  /**
   * Filters the pricing data to only include parcels with acreage values
   * between the user-input min and max acreage values.
   *
   * If the user has not entered valid numeric values for both min and max
   * acreage, an alert is shown and the function returns without modifying
   * the state.
   */
/******  57672cdb-8504-4ea1-8660-a20d408df2ad  *******/      return;
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
    const filteredCompsData = shapeFilteredData.filter(
      (item) => item.type === "comps"
    );
    if (filteredPricingData.length === 0 && filteredCompsData.length === 0) {
      alert("No data points within the drawn shape to download.");
      return;
    }
    const pricingDataTab = filteredPricingData.map((item) => ({
      APN: item.apn,
      "LOT ACREAGE": item.lotAcreage,
      Latitude: item.latitude,
      Longitude: item.longitude,
    }));
    const compsDataTab = filteredCompsData.map((item) => ({
      PRICE: item.price,
      ACRES: item.acres,
      Latitude: item.latitude,
      Longitude: item.longitude,
    }));
    const workbook = XLSX.utils.book_new();
    if (pricingDataTab.length > 0) {
      const pricingSheet = XLSX.utils.json_to_sheet(pricingDataTab);
      XLSX.utils.book_append_sheet(workbook, pricingSheet, "Pricing Data");
    }
    if (compsDataTab.length > 0) {
      const compsSheet = XLSX.utils.json_to_sheet(compsDataTab);
      XLSX.utils.book_append_sheet(workbook, compsSheet, "Comps Data");
    }
    XLSX.writeFile(workbook, "filtered_data.xlsx");

    const exportedAPNs = new Set(filteredPricingData.map((item) => item.apn));
    setLocations((prev) =>
      prev.filter(
        (loc) => !exportedAPNs.has(loc.details["APN - FORMATTED"])
      )
    );
    setPricingData((prev) =>
      prev.filter((pt) => !exportedAPNs.has(pt.apn))
    );

    setShapeFilteredData([]);
    setAcreageFilteredData([]);

    alert("Filtered data downloaded and removed from the map.");

    // Only call applyAcreageFilter if both min and max acreage are valid numbers.
    if (!isNaN(parseFloat(minAcreage)) && !isNaN(parseFloat(maxAcreage))) {
      applyAcreageFilter();
    }
  };

  return (
    <div style={{ height: "98vh", width: "100%", position: "relative" }}>
      {isMobile && !showControlPanel && (
        <button
          className="hamburger-button"
          onClick={() => setShowControlPanel(true)}
        >
          ☰
        </button>
      )}

      {(!isMobile || showControlPanel) && (
        <div className="control-panel">
          {isMobile && (
            <button
              className="close-button"
              onClick={() => setShowControlPanel(false)}
            >
              ×
            </button>
          )}
          <h3>Data Controls</h3>
          <div className="dropdown-container">
            <StateDropdown
              states={states}
              selectedStateUrl={selectedStateUrl}
              onSelect={(url) => setSelectedStateUrl(url)}
            />
          </div>
          <div className="upload-row">
            <div className="upload-group">
              <button
                className="btn-danger"
                onClick={() =>
                  mainInputRef.current && mainInputRef.current.click()
                }
              >
                📤 Main 
              </button>
              <input
                type="file"
                accept=".csv"
                ref={mainInputRef}
                onChange={handleMainCSVUpload}
                className="hidden-input"
              />
              {mainUploaded && (
                <div className="uploaded-text">File Uploaded</div>
              )}
            </div>
            <div className="upload-group">
              <button
                className="btn-green"
                // style={{ backgroundColor: "green", borderColor: "green", color:"white" }}
                onClick={() =>
                  pricingInputRef.current && pricingInputRef.current.click()
                }
              >📤 Pricing 
              </button>
              <input
                type="file"
                accept=".csv"
                ref={pricingInputRef}
                onChange={handlePricingCSVUpload}
                className="hidden-input"
              />
              {pricingUploaded && (
                <div className="uploaded-text">File Uploaded</div>
              )}
            </div>
          </div>
          <div className="acreage-container">
            <h4 style={{ textAlign: "center" }}>Acreage Filter</h4>
            <div className="acreage-row">
              <label>Min :</label>
              <input
                type="number"
                value={minAcreage}
                onChange={(e) => setMinAcreage(e.target.value)}
                className="acreage-input"
              />
            </div>
            <div className="acreage-row">
              <label>Max :</label>
              <input
                type="number"
                value={maxAcreage}
                onChange={(e) => setMaxAcreage(e.target.value)}
                className="acreage-input"
              />
            </div>
            <div className="acreage-buttons">
              <button onClick={applyAcreageFilter} className="btn-primary">
                Apply Filter
              </button>
              <button
                onClick={clearFilters}
                className="btn-clear"
                style={{ marginLeft: "10px" }}
              >
                Clear Filter
              </button>
            </div>
          </div>
          <div className="action-buttons">
            <button onClick={downloadFilteredDataToExcel} className="btn-primary">
              📥 Download
            </button>
            <button
              onClick={() => deleteLastShapeRef.current()}
              className="btn-danger"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={[41.2033, -77.1945]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {selectedStateUrl && (
          <Suspense fallback={null}>
            <ZipOverlay zipUrl={selectedStateUrl} />
          </Suspense>
        )}
        <DrawHandler
          setShapeFilteredData={setShapeFilteredData}
          pricingDataRef={pricingDataRef}
          locationsRef={locationsRef}
          acreageFilteredDataRef={acreageFilteredDataRef}
          setDeleteFunction={(fn) => {
            deleteLastShapeRef.current = fn;
          }}
        />
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
        <VisiblePricingCircleMarkers
          pricingData={pricingData}
          acreageFilteredData={acreageFilteredData}
        />
      </MapContainer>
    </div>
  );
}

/* ------------------------------------------------------------------
   State Dropdown Component with a search box
------------------------------------------------------------------- */
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
          border: "1px solid rgba(0,0,0,0.5)",
          borderRadius: "4px",
          cursor: "pointer",
          background: "rgba(255,255,255,0.8)",
        }}
      >
        {selectedStateUrl
          ? states.find((s) => s.url === selectedStateUrl)?.name
          : "Select State"}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "rgba(255,255,255,0.95)",
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
            style={{
              width: "100%",
              padding: "6px",
              boxSizing: "border-box",
              border: "none",
              outline: "none",
            }}
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
                textAlign: "left",
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


