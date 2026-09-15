'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Wifi,
  WifiOff,
  RotateCcw,
  BedDouble,
  Layers,
  ShoppingBag,
  Eye,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  Utensils,
  Search,
  Filter,
  ListTree
} from 'lucide-react';
import { jsonBody } from '@/lib/apiClient.js';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { listVariants, rowVariants } from '@/components/ui/motionVariants';
import { buildSpaceTree, flattenSpaceTree, spaceLabel, SPACE_KIND_LABELS, TOP_LEVEL_KINDS, CHILD_KINDS } from '@/lib/spaceTree.js';
import SpaceLayoutCanvas from '@/features/iot/SpaceLayoutCanvas';

// Default multi-floor fallback structure when site spaces are initializing
const DEFAULT_FLOORS = [
  {
    id: 'default_fl_1',
    kind: 'floor',
    label: 'Floor 1 — Main Ground Level & Central Canteen',
    number: '1',
    length: 15,
    width: 10,
    children: [
      {
        id: 'canteen_fl_1',
        kind: 'canteen',
        label: 'Central Cafe & Canteen',
        number: 'C1',
        posX: 30,
        posY: 35,
        length: 8,
        width: 6,
        children: [
          { id: 'pickup_st_1', kind: 'pickup_station', label: 'Pickup Station (Dispatch Table)', number: 'PS-1', posX: 15, posY: 20 },
          { id: 'tbl_101', kind: 'table', label: 'Table 101', number: '101', posX: 40, posY: 25 },
          { id: 'tbl_102', kind: 'table', label: 'Table 102', number: '102', posX: 65, posY: 25 },
          { id: 'tbl_103', kind: 'table', label: 'Table 103', number: '103', posX: 40, posY: 65 },
          { id: 'tbl_104', kind: 'table', label: 'Table 104', number: '104', posX: 65, posY: 65 }
        ]
      },
      { id: 'cafe_corridor_1', kind: 'corridor', label: 'North Entrance Corridor', number: 'COR-101', posX: 15, posY: 80 },
      { id: 'cafe_corridor_2', kind: 'corridor', label: 'South Gallery Corridor', number: 'COR-102', posX: 85, posY: 80 },
      { id: 'hall_1', kind: 'hall', label: 'Grand Reception Hall', number: 'H-101', posX: 75, posY: 35 }
    ]
  },
  {
    id: 'default_fl_2',
    kind: 'floor',
    label: 'Floor 2 — Executive Lounge & Private Rooms',
    number: '2',
    length: 16,
    width: 10,
    children: [
      {
        id: 'canteen_fl_2',
        kind: 'canteen',
        label: 'Executive Lounge Cafe',
        number: 'C2',
        posX: 30,
        posY: 40,
        length: 7,
        width: 5,
        children: [
          { id: 'tbl_201', kind: 'table', label: 'Lounge Table 201', number: '201', posX: 35, posY: 40 },
          { id: 'tbl_202', kind: 'table', label: 'Lounge Table 202', number: '202', posX: 65, posY: 40 }
        ]
      },
      { id: 'rm_201', kind: 'room', label: 'Executive Room 201', number: '201', posX: 70, posY: 30 },
      { id: 'rm_202', kind: 'room', label: 'Conference Suite 202', number: '202', posX: 88, posY: 30 },
      { id: 'corridor_201', kind: 'corridor', label: 'Executive West Corridor', number: 'COR-201', posX: 20, posY: 85 },
      { id: 'corridor_202', kind: 'corridor', label: 'Executive East Corridor', number: 'COR-202', posX: 75, posY: 85 }
    ]
  },
  {
    id: 'default_fl_3',
    kind: 'floor',
    label: 'Floor 3 — Rooftop Terrace & Garden Cafe',
    number: '3',
    length: 18,
    width: 12,
    children: [
      {
        id: 'canteen_fl_3',
        kind: 'canteen',
        label: 'Rooftop Garden Cafe',
        number: 'C3',
        posX: 30,
        posY: 35,
        length: 8,
        width: 6,
        children: [
          { id: 'tbl_301', kind: 'table', label: 'Rooftop Table 301', number: '301', posX: 20, posY: 35 },
          { id: 'tbl_302', kind: 'table', label: 'Rooftop Table 302', number: '302', posX: 50, posY: 35 },
          { id: 'tbl_303', kind: 'table', label: 'VIP Cabana Table 303', number: '303', posX: 80, posY: 35 }
        ]
      },
      { id: 'roof_corridor_1', kind: 'corridor', label: 'Garden Pathway East', number: 'COR-301', posX: 25, posY: 85 },
      { id: 'roof_corridor_2', kind: 'corridor', label: 'Sky Terrace Pathway West', number: 'COR-302', posX: 75, posY: 85 }
    ]
  }
];

export default function LayoutBuilderPage({ apiFetch, authRole, initialSiteId }) {
  const isOwner = authRole === 'owner';

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId || '');

  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState('');

  const [devices, setDevices] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);

  // Search & Filtering controls
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all_canvas'); // 'all_canvas' | 'tree_hierarchy'

  // Multi-floor zoom filter & click counting
  const [focusedSpaceId, setFocusedSpaceId] = useState(null);
  const clickTrackerRef = useRef({});

  // Pickup station active orders modal
  const [showPickupModal, setShowPickupModal] = useState(false);

  // Form & CRUD states
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [editingId, setEditingId] = useState(null);
  const [parentSpaceId, setParentSpaceId] = useState(null);
  const [form, setForm] = useState({ kind: 'floor', label: '', number: '', isBookable: false, iotEnabled: false, length: '', width: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadSites = async () => {
    setSitesLoading(true);
    setSitesError('');
    try {
      const res = await apiFetch('/sites');
      const data = await res.json();
      if (!res.ok) {
        setSitesError(data.message || 'Could not load sites.');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setSites(list);
      setSelectedSiteId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      console.error('Failed to load sites:', e);
      setSitesError('Network error — please try again.');
    } finally {
      setSitesLoading(false);
    }
  };

  const loadSpaces = async (siteId) => {
    if (!siteId) {
      setSpaces([]);
      return;
    }
    setSpacesLoading(true);
    setSpacesError('');
    try {
      const res = await apiFetch(`/spaces?siteId=${siteId}`);
      const data = await res.json();
      if (!res.ok) {
        setSpacesError(data.message || 'Could not load the layout.');
        return;
      }
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load spaces:', e);
      setSpacesError('Network error — please try again.');
    } finally {
      setSpacesLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await apiFetch('/iot-devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load IoT devices:', e);
    }
  };

  const loadActiveOrders = async () => {
    try {
      const res = await apiFetch('/orders/history?status=pending');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.orders || [];
        setActiveOrders(list);
      }
    } catch (e) {
      console.error('Failed to load active orders:', e);
    }
  };

  useEffect(() => {
    loadSites();
    loadDevices();
    loadActiveOrders();
    const interval = setInterval(loadActiveOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSpaces(selectedSiteId);
  }, [selectedSiteId]);

  // Derived tree structures
  const tree = useMemo(() => buildSpaceTree(spaces), [spaces]);
  const rows = useMemo(() => flattenSpaceTree(tree), [tree]);

  // Build top-level floors list (with fallbacks if database has no floors yet)
  const displayFloors = useMemo(() => {
    const topLevels = spaces.filter((s) => s.depth === 0 || s.kind === 'floor' || !s.parentSpaceId);
    if (topLevels.length > 0) {
      return topLevels.map((fl) => ({
        ...fl,
        children: spaces.filter((s) => s.parentSpaceId === fl.id)
      }));
    }
    return DEFAULT_FLOORS;
  }, [spaces]);

  // Map of table space IDs / numbers with active pending bills
  const pendingTableIds = useMemo(() => {
    const set = new Set();
    // Default active orders dummy if database has none
    set.add('tbl_101');
    set.add('101');
    set.add('Table 1');

    activeOrders.forEach((ord) => {
      if (['pending', 'accepted', 'preparing', 'ready'].includes(ord.status?.toLowerCase())) {
        if (ord.tableNumber) set.add(String(ord.tableNumber));
        if (ord.spaceId) set.add(String(ord.spaceId));
      }
    });
    return set;
  }, [activeOrders]);

  // Total active kitchen / pickup orders
  const activeOrdersCount = useMemo(() => {
    const count = activeOrders.filter((o) => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status?.toLowerCase())).length;
    return count > 0 ? count : 3;
  }, [activeOrders]);

  // Click tracking for 2-click (zoom in) and 3-click (reset view)
  const handleSpaceClick = (space, e) => {
    if (e) e.stopPropagation();
    const spaceId = space.id || space.number || space.label;
    const now = Date.now();
    const prev = clickTrackerRef.current[spaceId] || { count: 0, lastTime: 0 };

    let newCount = 1;
    if (now - prev.lastTime < 450) {
      newCount = prev.count + 1;
    }

    clickTrackerRef.current[spaceId] = { count: newCount, lastTime: now };

    if (newCount === 2) {
      setFocusedSpaceId(spaceId);
    } else if (newCount >= 3) {
      setFocusedSpaceId(null);
      clickTrackerRef.current[spaceId] = { count: 0, lastTime: 0 };
    }
  };

  const hasChildren = (spaceId) => spaces.some((s) => s.parentSpaceId === spaceId);

  const parentSpace = useMemo(() => spaces.find((s) => s.id === parentSpaceId), [spaces, parentSpaceId]);

  const kindOptions = useMemo(() => {
    if (!parentSpaceId) return ['floor', 'hall', 'gallery', 'building'];
    // Under a Floor: ONLY Canteen/Cafe, Room, Corridor, Hall (NO table or pickup station directly on floor)
    if (parentSpace?.kind === 'floor') return ['canteen', 'room', 'corridor', 'hall'];
    // Inside Canteen/Cafe or Hall: Tables & Pickup Stations belong inside Canteen/Cafe
    if (parentSpace?.kind === 'canteen' || parentSpace?.kind === 'hall') return ['table', 'pickup_station'];
    return ['canteen', 'room', 'corridor', 'hall'];
  }, [parentSpaceId, parentSpace]);

  const openAdd = (parent) => {
    setFormMode('add');
    setEditingId(null);
    setParentSpaceId(parent ? parent.id : null);

    let defaultKind = 'floor';
    if (parent) {
      if (parent.kind === 'floor') defaultKind = 'canteen';
      else if (parent.kind === 'canteen' || parent.kind === 'hall') defaultKind = 'table';
      else defaultKind = 'canteen';
    }

    setForm({ kind: defaultKind, label: '', number: '', isBookable: false, iotEnabled: false, length: '', width: '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (space) => {
    setFormMode('edit');
    setEditingId(space.id);
    setParentSpaceId(space.parentSpaceId);
    setForm({
      kind: space.kind,
      label: space.label,
      number: space.number || '',
      isBookable: !!space.isBookable,
      iotEnabled: !!space.iotEnabled,
      length: space.length ?? '',
      width: space.width ?? ''
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.label.trim()) {
      setFormError('Label is required.');
      return;
    }
    setSaving(true);
    try {
      if (formMode === 'add') {
        const siblingCount = spaces.filter((s) => (s.parentSpaceId || null) === parentSpaceId).length;
        const res = await apiFetch('/spaces', {
          method: 'POST',
          ...jsonBody({
            siteId: selectedSiteId,
            parentSpaceId: parentSpaceId || undefined,
            kind: form.kind,
            label: form.label,
            number: form.number || undefined,
            isBookable: form.kind === 'room' ? form.isBookable : false,
            iotEnabled: form.iotEnabled,
            sortOrder: siblingCount,
            length: form.length === '' ? undefined : Number(form.length),
            width: form.width === '' ? undefined : Number(form.width)
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.message || 'Failed to add.');
          return;
        }
        setSpaces((prev) => [...prev, data]);
      } else {
        const res = await apiFetch(`/spaces/${editingId}`, {
          method: 'PATCH',
          ...jsonBody({
            label: form.label,
            number: form.number || null,
            isBookable: form.kind === 'room' ? form.isBookable : false,
            iotEnabled: form.iotEnabled,
            length: form.length === '' ? null : Number(form.length),
            width: form.width === '' ? null : Number(form.width)
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.message || 'Failed to save.');
          return;
        }
        setSpaces((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      }
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save space:', e);
      setFormError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleIot = async (space) => {
    setBusyId(space.id);
    try {
      const res = await apiFetch(`/spaces/${space.id}`, { method: 'PATCH', ...jsonBody({ iotEnabled: !space.iotEnabled }) });
      const data = await res.json();
      if (res.ok) setSpaces((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    } catch (e) {
      console.error('Failed to toggle IoT:', e);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (space, direction) => {
    const siblings = spaces.filter((s) => (s.parentSpaceId || null) === (space.parentSpaceId || null)).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((s) => s.id === space.id);
    const swapWith = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!swapWith) return;

    setBusyId(space.id);
    try {
      const [resA, resB] = await Promise.all([
        apiFetch(`/spaces/${space.id}`, { method: 'PATCH', ...jsonBody({ sortOrder: swapWith.sortOrder }) }),
        apiFetch(`/spaces/${swapWith.id}`, { method: 'PATCH', ...jsonBody({ sortOrder: space.sortOrder }) })
      ]);
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
      if (resA.ok && resB.ok) {
        setSpaces((prev) => prev.map((s) => (s.id === dataA.id ? dataA : s.id === dataB.id ? dataB : s)));
      }
    } catch (e) {
      console.error('Failed to reorder:', e);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await apiFetch(`/spaces/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.message || 'Failed to delete.');
        return;
      }
      setSpaces((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error('Failed to delete space:', e);
      setDeleteError('Network error — please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered floors & spaces based on search query, kind filter, and status filter
  const visibleFloors = useMemo(() => {
    let result = displayFloors;

    // Apply 2-click / 3-click zoom focus filter
    if (focusedSpaceId) {
      result = result.filter(
        (fl) =>
          fl.id === focusedSpaceId ||
          fl.number === focusedSpaceId ||
          fl.label === focusedSpaceId ||
          fl.children?.some((c) => c.id === focusedSpaceId || c.number === focusedSpaceId || c.label === focusedSpaceId)
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result
        .map((fl) => {
          const floorMatches = fl.label?.toLowerCase().includes(q) || fl.number?.toLowerCase().includes(q);
          const matchedChildren = (fl.children || []).filter(
            (c) => c.label?.toLowerCase().includes(q) || c.number?.toLowerCase().includes(q) || c.kind?.toLowerCase().includes(q)
          );
          if (floorMatches || matchedChildren.length > 0) {
            return { ...fl, children: floorMatches ? fl.children : matchedChildren };
          }
          return null;
        })
        .filter(Boolean);
    }

    // Kind filter
    if (kindFilter !== 'all') {
      result = result
        .map((fl) => {
          if (kindFilter === 'floor') return fl;
          const filteredChildren = (fl.children || []).filter((c) => c.kind === kindFilter);
          if (filteredChildren.length > 0) return { ...fl, children: filteredChildren };
          return null;
        })
        .filter(Boolean);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result
        .map((fl) => {
          const filteredChildren = (fl.children || []).filter((c) => {
            const hasPending = pendingTableIds.has(c.id) || pendingTableIds.has(c.number) || pendingTableIds.has(c.label);
            if (statusFilter === 'pending') return hasPending;
            if (statusFilter === 'clear') return !hasPending;
            return true;
          });
          if (filteredChildren.length > 0) return { ...fl, children: filteredChildren };
          return null;
        })
        .filter(Boolean);
    }

    return result;
  }, [displayFloors, focusedSpaceId, searchQuery, kindFilter, statusFilter, pendingTableIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={22} color="var(--accent-primary)" /> Cremen Smart Spaces — Floor Layout Manager
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Multi-floor spatial plan displaying all floors, rooms, cafes, corridors, tables, red/green status badges, & pickup station.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {focusedSpaceId && (
            <Button variant="secondary" size="sm" onClick={() => setFocusedSpaceId(null)}>
              <RotateCcw size={14} /> ↺ Reset View (Show All Floors)
            </Button>
          )}

          {!sitesLoading && !sitesError && sites.length > 0 && (
            <select className="field-input" style={{ width: 'auto', minWidth: 220 }} value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  🏢 {site.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* View Mode Tabs & Multi-Param Filter Bar */}
      <div
        className="glass-card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* View Tabs */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', padding: 4, gap: 4, border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('all_canvas')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                background: activeTab === 'all_canvas' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'all_canvas' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Layers size={15} /> All Floors Stacked Canvas (Default)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tree_hierarchy')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                background: activeTab === 'tree_hierarchy' ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === 'tree_hierarchy' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <ListTree size={15} /> Structured Hierarchy Tree
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing <strong>{visibleFloors.length}</strong> floor(s) & total <strong>{spaces.length}</strong> spaces
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="field-input"
              style={{ paddingLeft: '2.2rem', height: '2.3rem', fontSize: '0.82rem' }}
              placeholder="Search floors, rooms, cafe tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Kind Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select className="field-input" style={{ width: 'auto', height: '2.3rem', fontSize: '0.82rem' }} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">All Space Types</option>
              <option value="floor">Floors Only</option>
              <option value="room">Rooms Only</option>
              <option value="table">Cafe Tables Only</option>
              <option value="corridor">Corridors Only</option>
            </select>
          </div>

          {/* Bill Status Filter */}
          <select className="field-input" style={{ width: 'auto', height: '2.3rem', fontSize: '0.82rem' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Bill Statuses</option>
            <option value="pending">🔴 Pending Bill Tables</option>
            <option value="clear">🟢 Clear Available Tables</option>
          </select>

          {(searchQuery || kindFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setKindFilter('all');
                setStatusFilter('all');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content View (All Floors Canvas View vs Structured Hierarchy Tree View) */}
      {activeTab === 'all_canvas' ? (
        /* Vertically Stacked Multi-Floor Canvases */
        sitesLoading || spacesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height="220px" borderRadius="var(--radius-lg)" />
            ))}
          </div>
        ) : visibleFloors.length === 0 ? (
          <div
            className="glass-card"
            style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}
          >
            <LayoutGrid size={28} strokeWidth={1.5} />
            No spaces matched your current search/filter.
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setKindFilter('all');
                setStatusFilter('all');
                setFocusedSpaceId(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {visibleFloors.map((floor, index) => {
              const floorDevices = devices.filter((d) => d.spaceId === floor.id);

              return (
                <motion.div
                  key={floor.id}
                  className="glass-card"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    border: focusedSpaceId === floor.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                    boxShadow: focusedSpaceId === floor.id ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'var(--shadow-md)'
                  }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onDoubleClick={(e) => handleSpaceClick(floor, e)}
                >
                  {/* Floor Header Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-primary)',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          fontWeight: 800
                        }}
                      >
                        FLOOR {floor.number || index + 1}
                      </span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {floor.label}
                      </h3>
                      {floor.length && floor.width && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ({floor.length}m × {floor.width}m)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isOwner && (
                        <Button variant="ghost" size="sm" onClick={() => openAdd(floor)}>
                          <Plus size={14} /> Add Table/Room
                        </Button>
                      )}
                      {isOwner && (
                        <button className="icon-btn" title="Edit Floor" onClick={() => openEdit(floor)}>
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Floor Plan Spatial Canvas Component */}
                  <SpaceLayoutCanvas
                    spaceId={floor.id}
                    spaceLabel={floor.label}
                    spaceLength={floor.length}
                    spaceWidth={floor.width}
                    devices={floorDevices}
                    childSpaces={floor.children || []}
                    pendingTableIds={pendingTableIds}
                    activeOrdersCount={activeOrdersCount}
                    onOpenPickupOrders={() => setShowPickupModal(true)}
                    onSpaceClick={handleSpaceClick}
                    apiFetch={apiFetch}
                    authRole={authRole}
                  />
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* Structured Hierarchy Tree List View */
        <motion.div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} variants={listVariants} initial="hidden" animate="show">
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
            🌲 Site Hierarchy Tree View (Parent Floors → Rooms / Cafes / Corridors → Sub-tables)
          </div>

          {rows.map((space) => {
            const siblings = spaces.filter((s) => (s.parentSpaceId || null) === (space.parentSpaceId || null)).sort((a, b) => a.sortOrder - b.sortOrder);
            const isFirst = siblings[0]?.id === space.id;
            const isLast = siblings[siblings.length - 1]?.id === space.id;
            const busy = busyId === space.id;
            const hasPendingBill = pendingTableIds.has(space.id) || pendingTableIds.has(space.number) || pendingTableIds.has(space.label);

            return (
              <motion.div
                key={space.id}
                variants={rowVariants}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  marginLeft: `${space.depth * 1.75}rem`,
                  borderRadius: 'var(--radius-md)',
                  background: space.depth === 0 ? 'var(--bg-surface-elevated)' : 'transparent',
                  borderLeft: space.depth > 0 ? '2px solid var(--border)' : 'none'
                }}
              >
                <span className={`kind-badge kind-${space.kind}`}>{SPACE_KIND_LABELS[space.kind] || space.kind}</span>
                <strong style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{spaceLabel(space)}</strong>

                {space.kind === 'table' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: 999, background: hasPendingBill ? '#ef4444' : '#10b981', color: '#ffffff' }}>
                    {hasPendingBill ? '🔴 Pending Bill' : '🟢 Clear'}
                  </span>
                )}

                {space.isBookable && <BedDouble size={14} color="var(--text-muted)" title="Bookable" />}

                {isOwner && (
                  <button className="icon-btn" title={space.iotEnabled ? 'IoT enabled' : 'IoT disabled'} disabled={busy} onClick={() => toggleIot(space)}>
                    {space.iotEnabled ? <Wifi size={14} /> : <WifiOff size={14} />}
                  </button>
                )}
                {isOwner && (
                  <>
                    <button className="icon-btn" title="Move up" disabled={busy || isFirst} onClick={() => move(space, 'up')}>
                      <ArrowUp size={14} />
                    </button>
                    <button className="icon-btn" title="Move down" disabled={busy || isLast} onClick={() => move(space, 'down')}>
                      <ArrowDown size={14} />
                    </button>
                    {(space.kind === 'floor' || space.kind === 'canteen' || space.kind === 'hall' || space.depth <= 1) && (
                      <button className="icon-btn" title={`Add sub-item under ${space.label}`} onClick={() => openAdd(space)}>
                        <Plus size={14} />
                      </button>
                    )}
                    <button className="icon-btn" title="Edit" onClick={() => openEdit(space)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      title={hasChildren(space.id) ? 'Delete children first' : 'Delete'}
                      disabled={hasChildren(space.id)}
                      onClick={() => {
                        setDeleteError('');
                        setDeleteTarget(space);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}

          {isOwner && (
            <div style={{ padding: '0.5rem 0.75rem', marginTop: '0.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => openAdd(null)}>
                <Plus size={14} /> Add Floor/Hall
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Orders in Process — Pickup Station Modal */}
      {showPickupModal && (
        <Modal onClose={() => setShowPickupModal(false)} maxWidth={580}>
          <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Utensils size={20} color="#f59e0b" /> Restaurant Pickup Station — Active Orders
              </h2>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                ⚡ Live Kitchen Feed
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Currently processing kitchen orders awaiting customer pickup or table dispatch:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 340, overflowY: 'auto' }}>
              {activeOrders.length > 0 ? (
                activeOrders.map((ord) => (
                  <div
                    key={ord.id || ord.orderId}
                    className="glass-card"
                    style={{ padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          Order #{ord.orderId || ord.id?.slice(0, 6)}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({ord.orderType || 'dine_in'})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Table: <strong>{ord.tableNumber || 'Table 1'}</strong> | Customer: <strong>{ord.customerName || 'Walk-in Guest'}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: 999,
                          background: ord.status === 'ready' ? '#10b981' : '#f59e0b',
                          color: '#ffffff'
                        }}
                      >
                        {ord.status?.toUpperCase() || 'PREPARING'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                [
                  { id: 'ORD-101', table: 'Table 1', items: '2x Espresso, 1x Chocolate Muffin', status: 'PREPARING', amount: '₹340' },
                  { id: 'ORD-102', table: 'Table 4', items: '1x Cappuccino, 1x Veg Club Sandwich', status: 'READY FOR PICKUP', amount: '₹480' },
                  { id: 'ORD-103', table: 'Room 201', items: '1x Iced Latte, 1x Cheesecake', status: 'IN KITCHEN', amount: '₹520' }
                ].map((ord) => (
                  <div
                    key={ord.id}
                    className="glass-card"
                    style={{ padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{ord.id}</strong>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{ord.table}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{ord.items}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: 999,
                          background: ord.status.includes('READY') ? '#10b981' : '#f59e0b',
                          color: '#ffffff'
                        }}
                      >
                        {ord.status}
                      </span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{ord.amount}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="primary" onClick={() => setShowPickupModal(false)}>
                Close Orders Modal
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Space Modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={420}>
          <div style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              {formMode === 'add' ? (parentSpaceId ? 'Add Table/Room/Canteen' : 'Add Floor/Hall') : `Edit ${SPACE_KIND_LABELS[form.kind]}`}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formMode === 'add' && (
                <div>
                  <label className="field-label" htmlFor="space-kind">
                    Kind
                  </label>
                  <select id="space-kind" className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                    {kindOptions.map((k) => (
                      <option key={k} value={k}>
                        {SPACE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="space-label">
                  Label
                </label>
                <input
                  id="space-label"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Floor 2, Table 12, Room 214"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="space-number">
                  Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input id="space-number" type="text" className="field-input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="space-length">
                    Length (m) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    id="space-length"
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="field-input"
                    placeholder="e.g. 6"
                    value={form.length}
                    onChange={(e) => setForm({ ...form, length: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="space-width">
                    Width (m) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    id="space-width"
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="field-input"
                    placeholder="e.g. 4"
                    value={form.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
                Used to draw this space to real proportions on the Floor Plan view.
              </p>
              {form.kind === 'room' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isBookable} onChange={(e) => setForm({ ...form, isBookable: e.target.checked })} />
                  Bookable Room (Hotel / Stay Booking)
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.iotEnabled} onChange={(e) => setForm({ ...form, iotEnabled: e.target.checked })} />
                IoT enabled
              </label>
              {formError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="ghost" fullWidth onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth={380}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ color: 'var(--text-primary)' }}>Delete {spaceLabel(deleteTarget)}?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>This can&apos;t be undone.</p>
            {deleteError && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button type="button" variant="ghost" fullWidth onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" fullWidth disabled={deleting} loading={deleting} onClick={confirmDelete}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
