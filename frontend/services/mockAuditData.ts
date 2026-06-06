// ─────────────────────────────────────────────────────────────────────────
// QueryPal · Audit log sample data (dev / USE_MSAL_AUTH=false)
//
// Mirrors the real `write_audit_log` PostgreSQL table written by
// data_documents_service.log_write_operation():
//
//   user_email      — Entra ID email of the actor
//   operation       — 'insert' | 'update' | 'delete'
//   database_name   — "<cosmos_account>.<database>"  (account.database)
//   collection_name
//   document_id     — Mongo ObjectId / business id
//   diff_data       — update: { field: { before, after } }
//                   — insert: full inserted document
//                   — delete: full deleted document
//   timestamp_utc   — ISO 8601 timestamptz
//
// Context: Virtonomy biomechanical-simulation / clinical-study workspace.
// Timestamps are anchored to module load so the feed always reads as recent.
// ─────────────────────────────────────────────────────────────────────────

interface MockRow {
    user_email: string;
    operation: 'insert' | 'update' | 'delete';
    collection_name: string;
    document_id: string;
    diff_data: any;
    /** minutes before "now" */
    agoMin: number;
}

const DB = 'vt-prod-cosmos-eu.virtonomy-prod';
const H = 60;
const D = 24 * 60;

const ROWS: MockRow[] = [
    // ── today ────────────────────────────────────────────────────────────
    { user_email: 'm.bauer@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '6724f8a2c1d4e8f5b9a23104', agoMin: 18,
        diff_data: { status: { before: 'review', after: 'converged' }, reviewed_by: { before: null, after: 'm.bauer@virtonomy.io' }, 'metrics.min_safety_factor': { before: 1.79, after: 1.84 } } },

    { user_email: 'a.kowal@virtonomy.io', operation: 'update', collection_name: 'simulations', document_id: '6731ab09f2e4c1a7d8b40021', agoMin: 42,
        diff_data: { 'solver.max_iterations': { before: 4000, after: 6000 }, 'solver.tolerance': { before: 0.001, after: 0.0005 }, status: { before: 'diverged', after: 'queued' } } },

    { user_email: 's.rocha@virtonomy.io', operation: 'insert', collection_name: 'studies', document_id: '685f0c11a9d3b4e6c2f10099', agoMin: 67,
        diff_data: { studyId: 'VTN-26-ORTH-0214', title: 'Knee tibial tray — fatigue, ISO 14879-1', device: { vendor: 'Zimmer', model: 'Persona', size_mm: null }, status: 'queued', dept: 'Ortho', tags: ['ortho', 'fatigue'] } },

    { user_email: 'ci-pipeline@virtonomy.io', operation: 'update', collection_name: 'simulations', document_id: '6731ab09f2e4c1a7d8b3fe88', agoMin: 95,
        diff_data: { status: { before: 'running', after: 'converged' }, 'metrics.max_stress_mpa': { before: null, after: 388.1 }, runtime_seconds: { before: null, after: 14201 } } },

    { user_email: 'h.weiss@virtonomy.io', operation: 'delete', collection_name: 'studies', document_id: '66f1d4e8c1a2b3049f8e7712', agoMin: 140,
        diff_data: { studyId: 'VTN-26-VASC-0051', title: 'Duplicate import — stentgraft AAA', status: 'diverged', dept: 'Vascular', reviewed_by: null, tags: ['vasc.', 'duplicate'] } },

    { user_email: 'a.kowal@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '6724f8a2c1d4e8f5b9a23104', agoMin: 165,
        diff_data: { 'mesh.avg_quality': { before: 0.78, after: 0.81 }, 'mesh.elements': { before: 1810442, after: 1842301 } } },

    { user_email: 'm.bauer@virtonomy.io', operation: 'update', collection_name: 'patients', document_id: '66be1209a7c4d8e1f0923b12', agoMin: 190,
        diff_data: { 'demographics.bsa': { before: 1.58, after: 1.62 }, 'flags.hypertension': { before: false, after: true } } },

    // ── 1–2 days ago ──────────────────────────────────────────────────────
    { user_email: 'l.tanaka@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '67120bcd44a1e9f3c0b51177', agoMin: 1 * D + 2 * H,
        diff_data: { status: { before: 'queued', after: 'review' }, reviewer: { before: 'l.tanaka', after: 'l.tanaka' }, notes: { before: '', after: 'Flow diverter wall apposition looks marginal at the neck — needs second pass.' } } },

    { user_email: 'ci-pipeline@virtonomy.io', operation: 'insert', collection_name: 'outcomes', document_id: '6720aa01b2c3d4e5f6071234', agoMin: 1 * D + 4 * H,
        diff_data: { studyId: 'VTN-26-CARD-0934', metric: 'radial_force_n', value: 47.1, passed: true, computed_by: 'solver-v4.2' } },

    { user_email: 's.rocha@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '670f1a2b3c4d5e6f70819293', agoMin: 1 * D + 6 * H,
        diff_data: { status: { before: 'review', after: 'converged' }, reviewed_by: { before: null, after: 's.rocha@virtonomy.io' }, sign_off: { before: null, after: '2026-06-02T09:14:00Z' } } },

    { user_email: 'h.weiss@virtonomy.io', operation: 'update', collection_name: 'devices', document_id: '66a0c1d2e3f405162738a9b0', agoMin: 1 * D + 9 * H,
        diff_data: { 'spec.nominal_diameter_mm': { before: 28, after: 30 }, lot: { before: 'LOT-2451', after: 'LOT-2466' } } },

    { user_email: 'a.kowal@virtonomy.io', operation: 'delete', collection_name: 'simulations', document_id: '6731ab09f2e4c1a7d8b3fa01', agoMin: 1 * D + 11 * H,
        diff_data: { studyId: 'VTN-26-CARD-0938', solver: 'implicit', status: 'diverged', reason: 'superseded by re-run', runtime_seconds: 25320 } },

    { user_email: 'm.bauer@virtonomy.io', operation: 'insert', collection_name: 'cohorts', document_id: '6726b8c9d0e1f2031425a6b7', agoMin: 1 * D + 14 * H,
        diff_data: { name: 'TAVR cohort IV — bicuspid', criteria: { valve_type: 'bicuspid', device_vendor: 'Edwards' }, size: 38, owner: 'm.bauer@virtonomy.io' } },

    // ── 3–4 days ago ──────────────────────────────────────────────────────
    { user_email: 'l.tanaka@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '67120bcd44a1e9f3c0b51177', agoMin: 3 * D + 1 * H,
        diff_data: { 'mesh.avg_quality': { before: 0.71, after: 0.74 }, tags: { before: ['neuro'], after: ['neuro', 'remesh'] } } },

    { user_email: 'ci-pipeline@virtonomy.io', operation: 'update', collection_name: 'simulations', document_id: '6731ab09f2e4c1a7d8b3f502', agoMin: 3 * D + 3 * H,
        diff_data: { status: { before: 'running', after: 'diverged' }, 'metrics.min_safety_factor': { before: null, after: 0.94 }, error: { before: null, after: 'NaN residual at iter 5120' } } },

    { user_email: 's.rocha@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '66ff20a1b2c3d4e5f6071820', agoMin: 3 * D + 5 * H,
        diff_data: { 'metrics.contact_area_mm2': { before: 34.7, after: 38.2 }, 'metrics.max_stress_mpa': { before: 421.9, after: 412.3 } } },

    { user_email: 'm.bauer@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '6724f8a2c1d4e8f5b9a23104', agoMin: 3 * D + 8 * H,
        diff_data: { tags: { before: ['cardiac', 'valve'], after: ['cardiac', 'valve', 'completed'] }, reviewed_by: { before: 'a.kowal@virtonomy.io', after: 'm.bauer@virtonomy.io' } } },

    { user_email: 'h.weiss@virtonomy.io', operation: 'insert', collection_name: 'studies', document_id: '67340a1b2c3d4e5f60718293', agoMin: 4 * D + 2 * H,
        diff_data: { studyId: 'VTN-26-VASC-0058', title: 'Stentgraft migration — abdominal AAA, re-run', device: { vendor: 'Cook', model: 'Zenith Alpha' }, status: 'queued', dept: 'Vascular', tags: ['vasc.'] } },

    { user_email: 'a.kowal@virtonomy.io', operation: 'update', collection_name: 'meshes', document_id: '66cd0e1f2a3b4c5d6e7f8090', agoMin: 4 * D + 6 * H,
        diff_data: { element_count: { before: 920441, after: 1042118 }, 'quality.min_jacobian': { before: 0.12, after: 0.21 }, type: { before: 'tetra', after: 'tetra' } } },

    // ── 5–9 days ago ──────────────────────────────────────────────────────
    { user_email: 'l.tanaka@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '66ee10a9b8c7d6e5f4032211', agoMin: 5 * D + 3 * H,
        diff_data: { status: { before: 'converged', after: 'review' }, notes: { before: 'auto-approved', after: 'Re-opened: SF below threshold for bicuspid subgroup.' } } },

    { user_email: 'ci-pipeline@virtonomy.io', operation: 'insert', collection_name: 'outcomes', document_id: '6720aa01b2c3d4e5f6079981', agoMin: 5 * D + 7 * H,
        diff_data: { studyId: 'VTN-26-CARD-0914', metric: 'min_safety_factor', value: 1.62, passed: false, computed_by: 'solver-v4.2' } },

    { user_email: 's.rocha@virtonomy.io', operation: 'update', collection_name: 'patients', document_id: '66be1209a7c4d8e1f0923c45', agoMin: 6 * D + 1 * H,
        diff_data: { 'demographics.age': { before: 71, after: 72 }, consent: { before: 'pending', after: 'signed' } } },

    { user_email: 'm.bauer@virtonomy.io', operation: 'delete', collection_name: 'cohorts', document_id: '6726b8c9d0e1f203142599aa', agoMin: 7 * D + 4 * H,
        diff_data: { name: 'TAVR cohort II — deprecated', size: 12, owner: 'm.bauer@virtonomy.io', reason: 'merged into cohort III' } },

    { user_email: 'h.weiss@virtonomy.io', operation: 'update', collection_name: 'studies', document_id: '66dd0c1b2a3948576655d4e3', agoMin: 8 * D + 2 * H,
        diff_data: { status: { before: 'review', after: 'converged' }, reviewed_by: { before: null, after: 'h.weiss@virtonomy.io' }, 'metrics.min_safety_factor': { before: 2.49, after: 2.54 } } },

    { user_email: 'a.kowal@virtonomy.io', operation: 'update', collection_name: 'simulations', document_id: '6731ab09f2e4c1a7d8b3e110', agoMin: 9 * D + 5 * H,
        diff_data: { 'solver.scheme': { before: 'explicit', after: 'implicit' }, 'solver.timestep': { before: 1e-6, after: 5e-7 } } },
];

const ANCHOR = Date.now();

export const MOCK_AUDIT_EVENTS = ROWS.map((r) => ({
    user_email: r.user_email,
    operation: r.operation,
    database_name: DB,
    collection_name: r.collection_name,
    document_id: r.document_id,
    diff_data: r.diff_data,
    timestamp_utc: new Date(ANCHOR - r.agoMin * 60000).toISOString(),
}));
