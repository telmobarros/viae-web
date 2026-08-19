// ==========================|| COMMON OBJECTIVE FUNCTIONS ||=========================== //

const objectivesLabels = [
    { value: 'n_vehicles', label: 'Number of Vehicles' },
    { value: 'distance', label: 'Total Distance' },
    { value: 'travel_time', label: 'Total Travel Time' },
    { value: 'cost', label: 'Total Cost' },
    { value: 'vehicle_cost', label: 'Vehicle Cost' },
    { value: 'profit', label: 'Profit' },
    { value: 'n_customers', label: 'Number of Customers' },
    { value: 'missed_customers', label: 'Missed Customers' },
    { value: 'customer_waiting_time', label: 'Customer Waiting Time' },
    { value: 'time_window_violations', label: 'Time Window Violations' },
    { value: 'capacity_violations', label: 'Capacity Violations' },
    // Experimentation Mode certification pass: these are PRICED violation
    // counters -- admissible-but-penalised -- so they genuinely vary across
    // accepted solutions and are legitimate objective criteria. They were
    // registered backend metrics that the UI simply never offered.
    //
    // `hard_time_window_violations` is deliberately NOT here: is_admissible()
    // rejects any solution carrying one, so it is identically zero across every
    // solution a search accepts. Naming it would add a constant term and
    // optimise nothing. It stays a reported diagnostic.
    { value: 'duration_violations', label: 'Route Duration Violations' },
    { value: 'distance_violations', label: 'Route Distance Violations' },
    { value: 'fuel_violations', label: 'Fuel/Energy Violations' },
    { value: 'compartment_capacity_violations', label: 'Compartment Capacity Violations' },
    { value: 'compartment_compatibility_violations', label: 'Compartment Compatibility Violations' },
    { value: 'distance_diff', label: 'Distance Imbalance' },
    { value: 'travel_time_diff', label: 'Travel Time Imbalance' },
    { value: 'cost_diff', label: 'Cost Imbalance' },
    // Pass 12 / D7: ONE metric. Which RiskModel supplies its values is a
    // per-criterion binding (risk_model_id), not a separate pseudo-metric --
    // the previous `risk_<id>` scheme created one fake metric per model and
    // could never be weighted or validated.
    { value: 'unserved_risk', label: 'Unserved Risk', requiresRiskModel: true }
];

export default objectivesLabels;
