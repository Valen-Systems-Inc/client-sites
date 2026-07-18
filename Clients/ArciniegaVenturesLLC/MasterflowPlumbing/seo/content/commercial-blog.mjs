export const COMMERCIAL_BLOG_CATEGORIES = [
  {
    slug: "property-operations",
    name: "Property Operations",
    description: "Practical planning for property managers, facility teams, occupied buildings, maintenance records, access, and vendor coordination.",
  },
  {
    slug: "commercial-drains-and-sewers",
    name: "Commercial Drains and Sewers",
    description: "Recurring stoppages, shared lines, hydro jetting, camera inspections, cleanup, and service windows for busy properties.",
  },
  {
    slug: "trenchless-and-capital-projects",
    name: "Trenchless and Capital Projects",
    description: "Evidence, access, phasing, branch connections, repair choices, and documentation for larger sewer and piping work.",
  },
  {
    slug: "commercial-emergency-planning",
    name: "Commercial Emergency Planning",
    description: "How to prepare for leaks, backups, failed shutoffs, hot-water loss, and plumbing problems that can interrupt a property.",
  }
];

export const COMMERCIAL_BLOG_POSTS = [
  {
    slug: "commercial-plumbing-maintenance-plan",
    title: "What Belongs in a Commercial Plumbing Maintenance Plan?",
    description: "Build a useful maintenance plan around the property, known trouble spots, service history, access, and the plumbing that cannot be allowed to fail.",
    category: "property-operations",
    serviceSlug: "drain-cleaning",
    lede: "A useful maintenance plan is not a calendar full of generic inspections. It is a short list of the plumbing systems that create real risk for the property, who owns each task, and what records should be saved after the work.",
    sections: [
      {
        heading: "Start with the lines and equipment that affect operations",
        paragraphs: [
          "List shared sewer branches, recurring drain locations, lift or ejector equipment, water heaters, main shutoffs, aging valves, backflow-related plumbing, and any area where a failure would close units, restrooms, kitchens, or customer space.",
          "Use prior invoices, camera footage, leak history, tenant complaints, and onsite staff knowledge. A line that has backed up three times deserves more attention than a fixture that has never caused trouble."
        ]
      },
      {
        heading: "Keep the service record with the property",
        paragraphs: [
          "Save the date, affected line, access point, equipment used, camera findings, repair location, photos, and what the technician recommended watching. That record makes the next call faster and helps ownership see patterns across the portfolio.",
          "Assign one person to approve planned work and another contact for after-hours access. The best maintenance plan is the one the property team can actually use when something goes wrong."
        ]
      }
    ],
    checklist: ["Recurring trouble locations", "Main and local shutoffs", "Cleanouts and equipment access", "Prior camera footage", "After-hours contacts"]
  },
  {
    slug: "hydro-jetting-for-commercial-properties",
    title: "When Commercial Hydro Jetting Is Worth Scheduling",
    description: "Use line history, camera evidence, pipe condition, access, and operating needs to decide whether hydro jetting fits a commercial drain or sewer problem.",
    category: "commercial-drains-and-sewers",
    serviceSlug: "hydro-jetting",
    lede: "Hydro jetting is useful when buildup coats more of the pipe than a cable can clean. It is not a cure-all, and it should not be used blindly on a damaged or fragile line.",
    sections: [
      {
        heading: "Look for a pattern, not just one clog",
        paragraphs: [
          "Recurring grease, sludge, roots, scale, and heavy use are common reasons to discuss jetting. Identify which fixtures or tenants share the line, when the trouble returns, and whether previous cleaning only opened a narrow path.",
          "Camera footage can show offsets, breaks, liners, bad transitions, or other conditions that change the cleaning plan. Pipe condition comes before pressure."
        ]
      },
      {
        heading: "Schedule the work around the property",
        paragraphs: [
          "Choose the access point, service window, water-use restrictions, barriers, cleanup plan, and person who can approve added work if the camera finds damage. Restaurants and occupied properties may need staged access or after-hours work.",
          "After cleaning, keep the footage and service notes. They help the manager decide whether the line belongs on a maintenance schedule or needs repair."
        ]
      }
    ],
    checklist: ["Affected fixtures or tenants", "Cleanout access", "Pipe and liner history", "Preferred service window", "Camera and cleanup plan"]
  },
  {
    slug: "commercial-plumbing-downtime-planning",
    title: "Plan the Plumbing Work Before the Building Goes Offline",
    description: "Map affected fixtures, tenants, shutoffs, approvals, access, cleanup, and reopening requirements before commercial plumbing work begins.",
    category: "property-operations",
    serviceSlug: "sewer-line-repair",
    lede: "For a commercial property, the repair and the interruption are two separate problems. A solid plan covers both.",
    sections: [
      {
        heading: "Name what will be unavailable",
        paragraphs: [
          "List the restrooms, kitchens, units, tenant spaces, floors, drains, or equipment tied to the affected line. Confirm whether another branch or fixture group can stay in service while the work is underway.",
          "Identify shutoffs, cleanouts, loading areas, security requirements, parking restrictions, and the person who can approve a change in scope."
        ]
      },
      {
        heading: "Define how the area returns to service",
        paragraphs: [
          "The plan should include testing, cleanup, restored branch connections, barriers, documentation, and the condition required before tenants or customers return to the area.",
          "Keep the repair record with the property. The next technician should know where the line runs, what was repaired, and what the camera showed."
        ]
      }
    ],
    checklist: ["Affected operations", "Shutoffs and cleanouts", "Tenant or customer notice", "Approval contact", "Testing and reopening"]
  },
  {
    slug: "sewer-camera-inspections-for-property-due-diligence",
    title: "Using Sewer Camera Inspections in Commercial Due Diligence",
    description: "Know what a sewer camera can document, what it may miss, and which access and property conditions belong in the acquisition record.",
    category: "trenchless-and-capital-projects",
    serviceSlug: "sewer-line-repair",
    lede: "A sewer camera is most useful when the buyer receives the footage, line location, access notes, and a plain explanation of what was and was not visible.",
    sections: [
      {
        heading: "Ask for evidence you can keep",
        paragraphs: [
          "Record the entry point, direction, approximate distance, branch connections, material changes, roots, offsets, standing water, cracks, breaks, prior liners, and any section the camera could not pass.",
          "A camera does not show every buried condition or prove the life expectancy of the whole system. It does give the owner a much better starting point than a verbal summary."
        ]
      },
      {
        heading: "Connect the footage to property impact",
        paragraphs: [
          "A defect under landscaping is different from the same defect below a finished tenant space, parking lot, loading lane, or public walkway. Access and business interruption may change the cost more than the defect itself.",
          "Keep the footage with plans, repair proposals, and known cleanout locations so future capital work starts with the same record."
        ]
      }
    ],
    checklist: ["Camera footage", "Entry point and line direction", "Defect locations", "Access limitations", "Repair and disruption notes"]
  },
  {
    slug: "multifamily-sewer-backup-response-plan",
    title: "A Sewer Backup Plan for Multifamily Properties",
    description: "Prepare onsite teams for shared-line backups, resident calls, access, shutoffs, cleanup boundaries, and the records a plumber needs.",
    category: "commercial-emergency-planning",
    serviceSlug: "emergency-plumbing",
    lede: "When several units share a line, the first resident complaint may not be the source of the blockage. Onsite teams need a simple way to limit added flow, identify affected areas, and get the right access open.",
    sections: [
      {
        heading: "Give onsite staff a short emergency checklist",
        paragraphs: [
          "Note which fixtures or units are backing up, stop unnecessary water use on the affected stack or branch, keep residents away from sewage, and open the known cleanout or equipment area for the plumber.",
          "Have after-hours contacts, gate access, unit-entry procedures, and the manager authorized to approve emergency work available."
        ]
      },
      {
        heading: "Track repeated trouble by line",
        paragraphs: [
          "Save the units, fixtures, cleanout, cable or jetting work, camera footage, and repair location from each event. Repeated backups on the same branch should not look like unrelated calls in the property record.",
          "That history helps management compare maintenance, repair, and replacement instead of paying for the same emergency over and over."
        ]
      }
    ],
    checklist: ["Affected units and fixtures", "Resident notice", "Cleanout access", "After-hours entry", "Prior service records"]
  },
  {
    slug: "after-hours-plumbing-for-retail-and-restaurants",
    title: "How to Schedule After-Hours Plumbing for Retail and Restaurants",
    description: "Plan access, water use, equipment, cleanup, tenant contacts, and reopening around a retail or restaurant service window.",
    category: "property-operations",
    serviceSlug: "drain-cleaning",
    lede: "After-hours work can reduce customer disruption, but it still needs a real access and reopening plan. A locked utility room or missing approval contact can waste the entire service window.",
    sections: [
      {
        heading: "Confirm access before the crew is dispatched",
        paragraphs: [
          "Identify the tenant contact, property manager, security procedure, cleanouts, roof or equipment access, water shutoffs, loading area, and any alarm or gate instructions.",
          "Tell the crew which fixtures or operations must be ready by opening time and whether neighboring tenants share the line."
        ]
      },
      {
        heading: "Leave enough time for testing and cleanup",
        paragraphs: [
          "The schedule needs room to run fixtures, confirm drainage, restore branches, remove barriers, clean the work area, and explain any follow-up repair before the business reopens.",
          "If the camera finds damaged pipe, the approval contact should be reachable so the night does not end with an avoidable second shutdown."
        ]
      }
    ],
    checklist: ["Tenant and manager contacts", "Security and gate access", "Cleanouts and shutoffs", "Opening deadline", "Testing and cleanup time"]
  },
  {
    slug: "trenchless-sewer-work-in-occupied-properties",
    title: "What Trenchless Sewer Work Looks Like at an Occupied Property",
    description: "Understand access, cleaning, camera evidence, liner or replacement preparation, branch connections, curing, testing, and reopening.",
    category: "trenchless-and-capital-projects",
    serviceSlug: "sewer-line-repair",
    lede: "Trenchless work can reduce excavation, but it does not remove the need for access, preparation, branch planning, cleanup, and a realistic service window.",
    sections: [
      {
        heading: "The line must be understood before it is rebuilt",
        paragraphs: [
          "Camera footage, cleaning, pipe material, diameter, depth, offsets, missing sections, branches, and access points determine whether a trenchless method fits. Not every damaged line is a good candidate.",
          "The property team should know which fixtures connect to the line and which areas may lose service during preparation, curing, cutting, or testing."
        ]
      },
      {
        heading: "Branch connections and reopening matter",
        paragraphs: [
          "When a liner covers branch tie-ins, robotic cutting may be used to reopen them from inside the pipe. Those locations need to be mapped and confirmed before the line returns to service.",
          "The final record should include footage, repaired limits, reopened branches, access points, testing, and any remaining defect outside the completed scope."
        ]
      }
    ],
    checklist: ["Pre-work camera footage", "Pipe and branch map", "Access and outage window", "Branch reinstatement plan", "Final testing and video"]
  },
  {
    slug: "choosing-a-plumbing-vendor-for-a-property-portfolio",
    title: "Choosing a Plumbing Vendor for a Commercial Property Portfolio",
    description: "Compare licensing, response, coverage, documentation, equipment, communication, pricing, and the ability to work inside occupied properties.",
    category: "property-operations",
    serviceSlug: "emergency-plumbing",
    lede: "The cheapest single invoice is not always the lowest-cost plumbing vendor. Portfolio owners need a company that can respond, document the work, communicate with site teams, and recognize when the same line keeps failing.",
    sections: [
      {
        heading: "Check the basics before the emergency",
        paragraphs: [
          "Verify the contractor license, insurance requirements, service area, emergency availability, equipment, contact method, pricing process, invoicing needs, and who handles after-hours approvals.",
          "Ask how camera footage, repair photos, line locations, and recommendations are delivered. Good records matter when different managers or technicians touch the same property."
        ]
      },
      {
        heading: "Look for a vendor that understands occupied buildings",
        paragraphs: [
          "Commercial plumbing affects tenants, customers, staff, security, parking, kitchens, restrooms, and operating schedules. The vendor should ask about those conditions before the crew arrives.",
          "A regional portfolio also needs honest coverage. Confirm the address and scope each time, especially for planned work outside the contractor's normal emergency dispatch area."
        ]
      }
    ],
    checklist: ["License and insurance", "24/7 contact path", "Service corridor", "Documentation standard", "Pricing and approval process"]
  }
];
