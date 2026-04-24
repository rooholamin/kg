/**
 * Kingsgate home-service seed content (fixed UUIDs for idempotent upsert).
 * Does not include articles — magazine seed keeps sample articles.
 */

// Categories (6) — 2100… block
const CAT_HVAC = '21000000-0000-4000-8000-000000000001';
const CAT_PLUMB = '21000000-0000-4000-8000-000000000002';
const CAT_ELEC = '21000000-0000-4000-8000-000000000003';
const CAT_SMART = '21000000-0000-4000-8000-000000000004';
const CAT_SEASON = '21000000-0000-4000-8000-000000000005';
const CAT_IAQ = '21000000-0000-4000-8000-000000000006';

// Topics (24) — 2200… block
const TOP = (n) => `22000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const categories = [
  {
    id: CAT_HVAC,
    name: 'HVAC Maintenance',
    description: 'Heating, cooling, and year-round comfort systems for homeowners.',
    status: 'active',
  },
  {
    id: CAT_PLUMB,
    name: 'Plumbing Tips',
    description: 'Pipes, fixtures, and water efficiency for a trouble-free home.',
    status: 'active',
  },
  {
    id: CAT_ELEC,
    name: 'Electrical Safety',
    description: 'Safe wiring, panels, and modern electrical best practices.',
    status: 'active',
  },
  {
    id: CAT_SMART,
    name: 'Smart Home & Thermostats',
    description: 'Smart controls, automation, and energy-smart home upgrades.',
    status: 'active',
  },
  {
    id: CAT_SEASON,
    name: 'Seasonal Home Care',
    description: 'Checklists and maintenance for every season in your region.',
    status: 'active',
  },
  {
    id: CAT_IAQ,
    name: 'Indoor Air Quality',
    description: 'Filtration, humidity, and healthier air (legacy / reference).',
    status: 'archived',
  },
];

const topics = [
  // HVAC (4)
  {
    id: TOP(1),
    name: 'Furnace Maintenance',
    description: 'Annual tune-ups, filters, and safe heating habits.',
    categoryId: CAT_HVAC,
    targetKeyword: 'furnace maintenance',
    status: 'active',
  },
  {
    id: TOP(2),
    name: 'AC Maintenance',
    description: 'Coils, filters, and keeping cool air efficient.',
    categoryId: CAT_HVAC,
    targetKeyword: 'air conditioning maintenance',
    status: 'active',
  },
  {
    id: TOP(3),
    name: 'Ductwork & Airflow',
    description: 'Sealing ducts and balancing rooms for even comfort.',
    categoryId: CAT_HVAC,
    targetKeyword: 'ductwork sealing',
    status: 'active',
  },
  {
    id: TOP(4),
    name: 'Heat Pumps 101',
    description: 'How heat pumps work and simple homeowner care.',
    categoryId: CAT_HVAC,
    targetKeyword: 'heat pump maintenance',
    status: 'archived',
  },
  // Plumbing (4)
  {
    id: TOP(5),
    name: 'Leak Prevention',
    description: 'Find drips early and avoid water damage.',
    categoryId: CAT_PLUMB,
    targetKeyword: 'home leak detection',
    status: 'active',
  },
  {
    id: TOP(6),
    name: 'Water Heater Care',
    description: 'Flushing, anode checks, and efficiency tips.',
    categoryId: CAT_PLUMB,
    targetKeyword: 'water heater maintenance',
    status: 'active',
  },
  {
    id: TOP(7),
    name: 'Drain & Sewer Health',
    description: 'What not to put down the drain and when to call a pro.',
    categoryId: CAT_PLUMB,
    targetKeyword: 'clogged drain tips',
    status: 'active',
  },
  {
    id: TOP(8),
    name: 'Low-Flow Fixtures',
    description: 'Saving water without sacrificing comfort.',
    categoryId: CAT_PLUMB,
    targetKeyword: 'low flow fixtures',
    status: 'archived',
  },
  // Electrical (4)
  {
    id: TOP(9),
    name: 'Panel & Breaker Safety',
    description: 'Know your panel, breakers, and when to upgrade.',
    categoryId: CAT_ELEC,
    targetKeyword: 'electrical panel safety',
    status: 'active',
  },
  {
    id: TOP(10),
    name: 'GFCI & Outlets',
    description: 'Kitchen, bath, and outdoor protection basics.',
    categoryId: CAT_ELEC,
    targetKeyword: 'GFCI installation',
    status: 'active',
  },
  {
    id: TOP(11),
    name: 'Surge Protection',
    description: 'Whole-home and point-of-use surge strategies.',
    categoryId: CAT_ELEC,
    targetKeyword: 'whole house surge protector',
    status: 'active',
  },
  {
    id: TOP(12),
    name: 'Outdoor & Landscape Wiring',
    description: 'Exterior outlets, path lights, and code-aware installs.',
    categoryId: CAT_ELEC,
    targetKeyword: 'outdoor electrical safety',
    status: 'archived',
  },
  // Smart home (4)
  {
    id: TOP(13),
    name: 'Smart Thermostats',
    description: 'Scheduling, remote control, and comfort savings.',
    categoryId: CAT_SMART,
    targetKeyword: 'smart thermostat tips',
    status: 'active',
  },
  {
    id: TOP(14),
    name: 'Home Automation Hubs',
    description: 'Choosing platforms that play nicely together.',
    categoryId: CAT_SMART,
    targetKeyword: 'home automation hub',
    status: 'active',
  },
  {
    id: TOP(15),
    name: 'Voice & Scene Routines',
    description: 'Scenes, automations, and family-friendly defaults.',
    categoryId: CAT_SMART,
    targetKeyword: 'smart home routines',
    status: 'active',
  },
  {
    id: TOP(16),
    name: 'Energy Monitoring',
    description: 'Track usage and find waste without guesswork.',
    categoryId: CAT_SMART,
    targetKeyword: 'home energy monitor',
    status: 'archived',
  },
  // Seasonal (4)
  {
    id: TOP(17),
    name: 'Winterizing Your Home',
    description: 'Insulation, pipes, and draft sealing before cold sets in.',
    categoryId: CAT_SEASON,
    targetKeyword: 'winterize home checklist',
    status: 'active',
  },
  {
    id: TOP(18),
    name: 'Spring Home Prep',
    description: 'Roof, gutters, and exterior once-over after winter.',
    categoryId: CAT_SEASON,
    targetKeyword: 'spring home maintenance',
    status: 'active',
  },
  {
    id: TOP(19),
    name: 'Summer Cooling & Shade',
    description: 'Shading, fans, and smart cooling habits.',
    categoryId: CAT_SEASON,
    targetKeyword: 'summer home cooling tips',
    status: 'active',
  },
  {
    id: TOP(20),
    name: 'Fall Checklist',
    description: 'HVAC, weatherstripping, and safety before the holidays.',
    categoryId: CAT_SEASON,
    targetKeyword: 'fall home maintenance',
    status: 'archived',
  },
  // IAQ (4, category archived; mix topic status)
  {
    id: TOP(21),
    name: 'Air Purifiers & Filters',
    description: 'MERV ratings, replacement cadence, and room sizing.',
    categoryId: CAT_IAQ,
    targetKeyword: 'air purifier for home',
    status: 'active',
  },
  {
    id: TOP(22),
    name: 'Humidity & Comfort',
    description: 'Ideal RH ranges, dehumidifiers, and winter dryness.',
    categoryId: CAT_IAQ,
    targetKeyword: 'indoor humidity control',
    status: 'archived',
  },
  {
    id: TOP(23),
    name: 'Ventilation Upgrades',
    description: 'Bath fans, ERVs, and fresh air without waste.',
    categoryId: CAT_IAQ,
    targetKeyword: 'home ventilation system',
    status: 'active',
  },
  {
    id: TOP(24),
    name: 'HEPA & Allergen Reduction',
    description: 'Layering filters, vacuums, and pet dander control.',
    categoryId: CAT_IAQ,
    targetKeyword: 'HEPA air filter home',
    status: 'archived',
  },
];

module.exports = {
  categories,
  topics,
};
