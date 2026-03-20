// Duration map and square footage adjustment logic
// From v9.0 spec Section 4 (Matching Engine)

const DURATION_MAP = {
  'Basic Photo': 45,
  'Pro Photo': 60,
  'Deluxe Photo': 75,
  'Zillow Package': 75,
  'Matterport Package': 90,
  'Listing Video': 90,
  'Agent Video': 105,
  'Agents Choice Bundle': 105,
  'Brand Builder Bundle': 120,
  'Luxury Listing Bundle': 150,
  'Rental Package': 60,
  'Commercial Package': 60,
  'Land Package': 30,
  'Interior Only': 30,
  'Exterior Only': 20,
  'Drone Only': 20,
  'Ext + Drone': 30,
  'Cinematic Video Tour': 45,
  'Agent Video Tour': 60,
  'Zillow 3D Tour': 30,
  'Matterport 3D Tour': 45,
};

// Services where sq ft scaling is heavier (scan-heavy)
const SCAN_HEAVY_SERVICES = [
  'Matterport Package',
  'Matterport 3D Tour',
  'Commercial Package',
  'Luxury Listing Bundle',
];

// Add-on durations (on-site time additions)
const ADDON_DURATION_MAP = {
  'Agent Featured Add-On': 20,
  'Agent Video Tour Add-On': 45,
  'Cinematic Video Tour Add-On': 35,
  'Zillow Tour Add-On': 25,
  'Community Video Footage': 20,
  '3-6 Community Photos': 15,
  '20 Additional Photos': 15,
  '5-10 Detailed Photos': 15,
  '5-7 Vertical Photos': 10,
  'Matterport 3D Tour Add-On': 45,
  'Commercial 2D Floor Plan Add-On': 20,
};

// Post-production only add-ons (no on-site time)
const POST_PRODUCTION_ADDONS = [
  'Virtual Staging',
  'Virtual Twilight',
  'Virtual Fire Effect',
  'Virtual TV Screen Replacement',
  'Virtual Cord/Wire Removal',
  'Virtual Grass Replacement',
  'Virtual Driveway Cleanup',
  'Seasonal Refresh',
  'Highlight Building Unit',
  'Highlight Property Line',
  '3D Floor Plan Upgrade',
  'Virtual Rendering',
];

function getBaseDuration(serviceName) {
  return DURATION_MAP[serviceName] || 60; // default 60 if unknown
}

function getSqFtAdjustment(serviceName, sqFt) {
  if (!sqFt || sqFt <= 0) return 0;

  if (SCAN_HEAVY_SERVICES.includes(serviceName)) {
    if (sqFt >= 5000) return 30;
    if (sqFt >= 4000) return 15;
    return 0;
  }

  // All other services
  if (sqFt >= 4000) return 15;
  if (sqFt >= 3000) return 10;
  return 0;
}

function getAdjustedDuration(serviceName, sqFt) {
  const base = getBaseDuration(serviceName);
  const sqFtAdj = getSqFtAdjustment(serviceName, sqFt);
  return base + sqFtAdj;
}

function getServiceNames() {
  return Object.keys(DURATION_MAP);
}

module.exports = {
  DURATION_MAP,
  ADDON_DURATION_MAP,
  POST_PRODUCTION_ADDONS,
  getBaseDuration,
  getSqFtAdjustment,
  getAdjustedDuration,
  getServiceNames,
};
