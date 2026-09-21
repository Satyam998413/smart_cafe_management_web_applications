'use client';

import { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Zap,
  Activity,
  Fingerprint,
  Lock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  ArrowRight,
  RefreshCw,
  Info,
  Server,
  Layers,
  HelpCircle,
  FileCode2
} from 'lucide-react';

// Comprehensive topic definition dataset
const MQTT_TOPICS = [
  {
    id: 'heartbeat',
    title: '1. Device Heartbeat Liveness Ping',
    direction: 'Device -> Broker (Inbound Publish)',
    topicPattern: 'devices/{deviceId}/heartbeat',
    frequency: 'Every 30 seconds',
    returnTopic: 'None (Unacknowledged Ping)',
    description: 'Sent continuously by online IoT hardware (locks, biometric terminals) to report operational health and signal strength.',
    requestPayload: {
      wifiRssi: -65
    },
    schema: [
      { field: 'wifiRssi', type: 'Integer (dBm)', required: 'Optional', description: 'Wi-Fi Received Signal Strength Indicator (e.g. -30 is strong, -80 is weak).' }
    ],
    serverAction: 'Updates last_heartbeat_at timestamp in database. If timestamp is <= 60s, device status renders as Green Online; if > 60s, status reverts to Gray Offline.'
  },
  {
    id: 'enroll',
    title: '2. Biometric Multi-Image Enrollment',
    direction: 'Device -> Broker (Inbound Publish)',
    topicPattern: 'biometrics/{deviceId}/enroll',
    frequency: 'On-demand during staff registration',
    returnTopic: 'Available on /biometric-captures Manager Dashboard',
    description: 'Transmits biometric raw capture data (fingerprints or face scans). Fingerprint enrollment requires at least 3 distinct scan images for maximum match accuracy.',
    requestPayload: {
      modality: 'fingerprint',
      fingerPosition: 'thumb_right',
      sensorTemplateId: 'tmpl_1042',
      images: [
        { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', contentType: 'image/jpeg' },
        { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', contentType: 'image/jpeg' },
        { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', contentType: 'image/jpeg' }
      ]
    },
    schema: [
      { field: 'modality', type: 'String', required: 'Required', description: 'Biometric capture mode: "fingerprint" or "face".' },
      { field: 'fingerPosition', type: 'String', required: 'Optional', description: 'Finger location string (e.g. "thumb_right", "index_left").' },
      { field: 'sensorTemplateId', type: 'String', required: 'Optional', description: 'Local hardware slot ID allocated on biometric sensor module.' },
      { field: 'images', type: 'Array of Objects', required: 'Required (>= 3 for fingerprint)', description: 'Array containing image data objects with base64 encoded strings.' },
      { field: 'images[].data', type: 'String (Base64)', required: 'Required', description: 'Base64 image string representation of the captured biometric frame.' },
      { field: 'images[].contentType', type: 'String', required: 'Optional', description: 'MIME type of the image binary ("image/jpeg" or "image/png").' }
    ],
    serverAction: 'Decodes base64 buffers, saves images into private Supabase storage bucket (biometric_captures), and creates pending capture entry ready for manager assignment.'
  },
  {
    id: 'verify',
    title: '3. Biometric Verification & Access Request',
    direction: 'Device -> Broker (Inbound Publish)',
    topicPattern: 'biometrics/{deviceId}/verify',
    frequency: 'Triggered when user scans finger/face at door or terminal',
    returnTopic: 'access/{deviceId}/result (Result) & locks/{deviceId}/command (Door Control)',
    description: 'Device transmits live verification request to authenticate user and unlock smart lock or log attendance punch.',
    requestPayload: {
      modality: 'fingerprint',
      sensorTemplateId: 'tmpl_1042',
      confidence: 94.8
    },
    schema: [
      { field: 'modality', type: 'String', required: 'Required', description: 'Authentication modality: "fingerprint" or "face".' },
      { field: 'sensorTemplateId', type: 'String', required: 'Optional (Fingerprint)', description: 'Hardware sensor template slot number for high-speed local matching.' },
      { field: 'confidence', type: 'Float / Number', required: 'Optional', description: 'Matching score threshold percentage reported by sensor module.' },
      { field: 'image', type: 'Object (Face)', required: 'Required for Face', description: 'Object containing base64 data for facial recognition embedding matching.' }
    ],
    serverAction: 'Evaluates matching against registered users in database. Immediately dispatches verification outcome to return response topic access/{deviceId}/result, and if access is granted dispatches unlock payload to locks/{deviceId}/command.'
  },
  {
    id: 'access-result',
    title: '4. Access Verification Result (Return Response Topic)',
    direction: 'Broker -> Device (Outbound Response)',
    topicPattern: 'access/{deviceId}/result',
    frequency: 'Instant push response following biometrics/{deviceId}/verify',
    returnTopic: 'Subscribed by device at pairing boot time',
    description: 'The return response published back to the hardware device containing match outcome, user identity, color indicator, and authorization state.',
    requestPayload: {
      matched: true,
      accessResult: 'granted',
      userId: 'usr_8921034a-9b12',
      userName: 'Alexander Wright',
      userRole: 'staff',
      color: 'green',
      message: 'Access Granted - Welcome Alexander'
    },
    schema: [
      { field: 'matched', type: 'Boolean', required: 'Required', description: 'true if biometric print/face matched a active user in database.' },
      { field: 'accessResult', type: 'String', required: 'Required', description: '"granted" if authorized; "denied" if user unassigned or forbidden.' },
      { field: 'userId', type: 'String / UUID', required: 'Nullable', description: 'Unique database identifier of the matched user.' },
      { field: 'userName', type: 'String', required: 'Nullable', description: 'Full name of the user for LCD terminal display.' },
      { field: 'userRole', type: 'String', required: 'Nullable', description: 'User security role (owner, manager, staff, customer).' },
      { field: 'color', type: 'String', required: 'Required', description: '"green" for visual success indicator; "red" for denied/error.' },
      { field: 'message', type: 'String', required: 'Required', description: 'Human readable display message for terminal status screen.' }
    ],
    serverAction: 'Published automatically by the server after processing biometrics/{deviceId}/verify payload.'
  },
  {
    id: 'lock-command',
    title: '5. Lock Door Command (Return Command Topic)',
    direction: 'Broker -> Device (Outbound Command)',
    topicPattern: 'locks/{deviceId}/command',
    frequency: 'Triggered on access grant or remote dashboard unlock button',
    returnTopic: 'Subscribed by smart lock controller',
    description: 'Hardware command instructing smart lock solenoid actuator to physically release or engage door lock and cycle LED status.',
    requestPayload: {
      unlock: true,
      status: 'granted',
      color: 'green',
      durationSeconds: 5
    },
    schema: [
      { field: 'unlock', type: 'Boolean', required: 'Required', description: 'true to trigger relay/solenoid unlock; false to lock/relinquish.' },
      { field: 'status', type: 'String', required: 'Optional', description: 'Execution status flag ("granted", "denied", "manual_override").' },
      { field: 'color', type: 'String', required: 'Optional', description: 'LED indicator state ("green" for unlocked, "red" for access denied).' },
      { field: 'durationSeconds', type: 'Integer', required: 'Optional', description: 'Auto-relock timer threshold in seconds before latch engages.' }
    ],
    serverAction: 'Published when a biometric check grants access, or when an administrator clicks "Remote Unlock" on the /locks page.'
  }
];

export default function MqttDocsPage() {
  const [activeTab, setActiveTab] = useState('topics');
  const [copiedId, setCopiedId] = useState(null);
  const [simulatedTopic, setSimulatedTopic] = useState('verify');
  const [simulatedStatus, setSimulatedStatus] = useState('granted');

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSimulatedResultPayload = () => {
    if (simulatedStatus === 'granted') {
      return {
        accessResultTopic: 'access/LOCK-DEV-8891/result',
        accessResultPayload: {
          matched: true,
          accessResult: 'granted',
          userId: 'usr_7f8a1290-341e',
          userName: 'Sarah Jenkins',
          userRole: 'manager',
          color: 'green',
          message: 'Access Granted - Door Unlocked'
        },
        lockCommandTopic: 'locks/LOCK-DEV-8891/command',
        lockCommandPayload: {
          unlock: true,
          status: 'granted',
          color: 'green',
          durationSeconds: 5
        }
      };
    } else {
      return {
        accessResultTopic: 'access/LOCK-DEV-8891/result',
        accessResultPayload: {
          matched: false,
          accessResult: 'denied',
          userId: null,
          userName: null,
          userRole: null,
          color: 'red',
          message: 'Access Denied - Unrecognized Biometric'
        },
        lockCommandTopic: 'locks/LOCK-DEV-8891/command',
        lockCommandPayload: {
          unlock: false,
          status: 'denied',
          color: 'red'
        }
      };
    }
  };

  const simResult = getSimulatedResultPayload();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
            }}
          >
            <Cpu size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)' }}>
              MQTT Protocol & Topic Specifications
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', margin: '0.25rem 0 0 0' }}>
              Complete reference for IoT Smart Locks, Biometric Punching Terminals, and Verification Return Responses.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            Broker Transport Active (Port 1883)
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('topics')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'topics' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'topics' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeTab === 'topics' ? 'var(--fg-main)' : 'var(--fg-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Layers size={16} /> All Topics & Schemas
        </button>
        <button
          onClick={() => setActiveTab('auth')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'auth' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'auth' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeTab === 'auth' ? 'var(--fg-main)' : 'var(--fg-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ShieldCheck size={16} /> Connection & Security
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'simulator' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'simulator' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeTab === 'simulator' ? 'var(--fg-main)' : 'var(--fg-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Terminal size={16} /> Interactive Payload Simulator
        </button>
        <button
          onClick={() => setActiveTab('colors-taxonomy')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'colors-taxonomy' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'colors-taxonomy' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeTab === 'colors-taxonomy' ? 'var(--fg-main)' : 'var(--fg-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Activity size={16} /> Device Status Colors &amp; IoT Equipment
        </button>
      </div>

      {/* TAB 1: ALL TOPICS & SCHEMAS */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Key Return Response Rule Highlight Banner */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start'
            }}
          >
            <Info size={22} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.88rem', color: 'var(--fg-main)', lineHeight: 1.5 }}>
              <strong style={{ color: '#3b82f6' }}>Every Publish Data & Return Response Topology:</strong>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--fg-muted)' }}>
                MQTT is an asynchronous message protocol. When a device publishes a verification request to{' '}
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>biometrics/{'{deviceId}'}/verify</code>,
                the server processes the request and automatically publishes the return result payload to{' '}
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>access/{'{deviceId}'}/result</code>.
                If granted, it also dispatches an unlock command to{' '}
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>locks/{'{deviceId}'}/command</code>.
              </p>
            </div>
          </div>

          {/* Topics List */}
          {MQTT_TOPICS.map((topic) => {
            const isOutbound = topic.direction.includes('Outbound');
            const jsonText = JSON.stringify(topic.requestPayload, null, 2);

            return (
              <div
                key={topic.id}
                id={topic.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}
              >
                {/* Topic Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)' }}>{topic.title}</h2>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: 999,
                          background: isOutbound ? 'rgba(168, 85, 247, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                          color: isOutbound ? '#c084fc' : '#38bdf8',
                          border: isOutbound ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(14, 165, 233, 0.3)'
                        }}
                      >
                        {topic.direction}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--fg-muted)', margin: '0.35rem 0 0 0' }}>{topic.description}</p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(topic.topicPattern, `topic-${topic.id}`)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--fg-main)'
                    }}
                  >
                    {copiedId === `topic-${topic.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    Copy Topic Pattern
                  </button>
                </div>

                {/* Topic Pill & Details */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <div style={{ flex: 1, minWidth: 260, background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topic Namespace</div>
                    <code style={{ fontSize: '0.92rem', color: '#0ea5e9', fontWeight: 700, display: 'block', marginTop: 4 }}>{topic.topicPattern}</code>
                  </div>

                  <div style={{ flex: 1, minWidth: 220, background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transmission Rate / Frequency</div>
                    <div style={{ fontWeight: 600, color: 'var(--fg-main)', marginTop: 4 }}>{topic.frequency}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 260, background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Response Topic</div>
                    <div style={{ fontWeight: 600, color: '#10b981', marginTop: 4 }}>{topic.returnTopic}</div>
                  </div>
                </div>

                {/* JSON Payload Code Block & Data Schema Table */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                  {/* Sample JSON Payload */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Sample JSON Payload</span>
                      <button
                        onClick={() => copyToClipboard(jsonText, `json-${topic.id}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'none',
                          border: 'none',
                          color: '#0ea5e9',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {copiedId === `json-${topic.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        Copy JSON
                      </button>
                    </div>
                    <pre
                      style={{
                        background: '#0f172a',
                        color: '#38bdf8',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        margin: 0,
                        maxHeight: 280,
                        border: '1px solid #1e293b'
                      }}
                    >
                      {jsonText}
                    </pre>
                  </div>

                  {/* Field Schema Table */}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Field Data Types & Rules</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--fg-main)' }}>Field</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--fg-main)' }}>Type</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--fg-main)' }}>Rules</th>
                            <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--fg-main)' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topic.schema.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === topic.schema.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              <td style={{ padding: '0.45rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#0ea5e9' }}>{row.field}</td>
                              <td style={{ padding: '0.45rem 0.75rem', color: 'var(--fg-muted)' }}>{row.type}</td>
                              <td style={{ padding: '0.45rem 0.75rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: row.required.includes('Required') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                    color: row.required.includes('Required') ? '#f87171' : 'var(--fg-muted)'
                                  }}
                                >
                                  {row.required}
                                </span>
                              </td>
                              <td style={{ padding: '0.45rem 0.75rem', color: 'var(--fg-muted)' }}>{row.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Server Processing Logic Summary */}
                <div style={{ background: 'var(--bg-surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #0ea5e9', fontSize: '0.85rem', color: 'var(--fg-main)' }}>
                  <strong>Server Action:</strong> {topic.serverAction}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CONNECTION & SECURITY */}
      {activeTab === 'auth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Connection Overview */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={20} color="#0ea5e9" /> Embedded Aedes Broker Architecture
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
              The MQTT broker runs embedded directly inside the Node server host process via an integrated Aedes engine. Devices connect on standard TCP Port 1883 or WebSocket port without requiring external third-party broker instances.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Broker Address & Port</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0ea5e9', marginTop: 4 }}>mqtt://your-server-domain:1883</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 4 }}>Secure TLS: mqtts://your-server-domain:8883</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Device Client ID & Username</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-main)', marginTop: 4 }}>username = deviceId</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 4 }}>Example: LOCK-DEV-8891</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Device Authentication Token</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-main)', marginTop: 4 }}>password = deviceAccessToken</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 4 }}>Validated via verifyDeviceToken() signature check</div>
              </div>
            </div>
          </div>

          {/* Security & Namespace Authorization */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#10b981" /> Strict Per-Device Namespace Scoping
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
              Security rules enforced in broker hooks (<code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>authorizePublish</code> and <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>authorizeSubscribe</code>) guarantee complete isolation between devices.
            </p>

            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--fg-main)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li>
                <strong>Publish Restriction:</strong> A device authenticated with ID <code style={{ color: '#0ea5e9' }}>LOCK-DEV-8891</code> can ONLY publish under <code style={{ color: '#0ea5e9' }}>devices/LOCK-DEV-8891/*</code> or <code style={{ color: '#0ea5e9' }}>biometrics/LOCK-DEV-8891/*</code>. Attempts to publish under another device ID return an immediate <em>Forbidden</em> error.
              </li>
              <li>
                <strong>Subscription Isolation:</strong> A device can ONLY subscribe to its own return response topics (<code style={{ color: '#10b981' }}>access/LOCK-DEV-8891/result</code> and <code style={{ color: '#10b981' }}>locks/LOCK-DEV-8891/command</code>). Prevents devices from eavesdropping on unassigned hardware commands.
              </li>
              <li>
                <strong>Payload Limits:</strong> Biometric enroll payloads containing base64 images should stay under 5 MB total frame batch size.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE PAYLOAD SIMULATOR */}
      {activeTab === 'simulator' && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} color="#0ea5e9" /> Interactive MQTT Publish-Response Simulator
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--fg-muted)', margin: '0.25rem 0 0 0' }}>
              Simulate an inbound publish request from a device and view the generated return response payloads broadcast to <code style={{ color: '#10b981' }}>access/LOCK-DEV-8891/result</code> and <code style={{ color: '#10b981' }}>locks/LOCK-DEV-8891/command</code>.
            </p>
          </div>

          {/* Simulator Control Panel */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Simulated Topic</label>
              <select
                value={simulatedTopic}
                onChange={(e) => setSimulatedTopic(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg-main)', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <option value="verify">biometrics/LOCK-DEV-8891/verify (Fingerprint Access)</option>
                <option value="heartbeat">devices/LOCK-DEV-8891/heartbeat (Liveness Ping)</option>
              </select>
            </div>

            {simulatedTopic === 'verify' && (
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Verification Match Outcome</label>
                <select
                  value={simulatedStatus}
                  onChange={(e) => setSimulatedStatus(e.target.value)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg-main)', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  <option value="granted">Matched User & Access Granted (Green)</option>
                  <option value="denied">Unknown User & Access Denied (Red)</option>
                </select>
              </div>
            )}
          </div>

          {/* Dual Flow Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {/* Left Column: Device Inbound Publish */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#0ea5e9' }}>
                <ArrowRight size={18} /> STEP 1: Device Publishes Payload
              </div>
              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>Topic: <code style={{ color: '#38bdf8' }}>{simulatedTopic === 'verify' ? 'biometrics/LOCK-DEV-8891/verify' : 'devices/LOCK-DEV-8891/heartbeat'}</code></div>
                <pre style={{ margin: 0, color: '#38bdf8', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                  {JSON.stringify(
                    simulatedTopic === 'verify'
                      ? { modality: 'fingerprint', sensorTemplateId: 'tmpl_1042', confidence: simulatedStatus === 'granted' ? 96.2 : 31.0 }
                      : { wifiRssi: -62 },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            {/* Right Column: Server Outbound Return Response */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>
                <CheckCircle2 size={18} /> STEP 2: Server Dispatches Return Response Topic
              </div>

              {simulatedTopic === 'verify' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Access Result Payload */}
                  <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>Return Response Topic: <code style={{ color: '#4ade80' }}>{simResult.accessResultTopic}</code></div>
                    <pre style={{ margin: 0, color: '#4ade80', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {JSON.stringify(simResult.accessResultPayload, null, 2)}
                    </pre>
                  </div>

                  {/* Lock Command Payload */}
                  <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>Return Lock Command Topic: <code style={{ color: '#c084fc' }}>{simResult.lockCommandTopic}</code></div>
                    <pre style={{ margin: 0, color: '#c084fc', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {JSON.stringify(simResult.lockCommandPayload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Heartbeat pings are lightweight async updates. No response topic transmission required.
                </div>
              )}
            </div>
          </div>
        </div>
      {/* TAB 4: DEVICE STATUS COLORS & IOT EQUIPMENT TAXONOMY */}
      {activeTab === 'colors-taxonomy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Colors Legend Section */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="#10b981" /> Universal Device Status Color System
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
              Across all layout canvases, device control cards, smart lock grids, and hardware status screens, device state and access control feedback follow a standardized color system.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {/* Green */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
                  Green Status Indicator (`color: "green"`)
                </div>
                <ul style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--fg-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>Device Online:</strong> Heartbeat received within last 60s.</li>
                  <li><strong>Access Granted:</strong> Biometric scan matched and user authorized.</li>
                  <li><strong>Door Lock:</strong> Solenoid unlocked (`unlock: true`).</li>
                  <li><strong>Equipment Power:</strong> Power relay ON (`on_off: true`).</li>
                </ul>
              </div>

              {/* Red */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: '#ef4444', fontSize: '1rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }} />
                  Red Status Indicator (`color: "red"`)
                </div>
                <ul style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--fg-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>Access Denied:</strong> Biometric scan failed or grant missing.</li>
                  <li><strong>Door Lock:</strong> Door locked / solenoid engaged (`is_locked: true`).</li>
                  <li><strong>Security Event:</strong> Unauthorized attempt logged.</li>
                  <li><strong>Equipment Power:</strong> Power relay OFF (`on_off: false`).</li>
                </ul>
              </div>

              {/* Gray */}
              <div style={{ background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: '#94a3b8', fontSize: '1rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#94a3b8' }} />
                  Gray Status Indicator (`color: "gray"`)
                </div>
                <ul style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--fg-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>Device Offline:</strong> Heartbeat timeout &gt; 60 seconds (1 min).</li>
                  <li><strong>Disconnected:</strong> Hardware powered down or network dropped.</li>
                  <li><strong>Unreachable:</strong> Device missing from heartbeat registry.</li>
                </ul>
              </div>

              {/* Amber */}
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: '#f59e0b', fontSize: '1rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }} />
                  Amber Status Indicator (`color: "amber"`)
                </div>
                <ul style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--fg-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li><strong>Pending Processing:</strong> Asynchronous face embedding extraction running.</li>
                  <li><strong>Unassigned Credential:</strong> Capture ready awaiting staff assignment in manager queue.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* IoT Equipment Status Taxonomy Reference */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={20} color="#0ea5e9" /> IoT Hardware Taxonomy &amp; Status Reference
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {/* Smart Locks */}
              <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={18} color="#0ea5e9" /> Smart Locks (Wi-Fi / RFID / Biometric)
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  Door entry controllers. Supports remote unlock, RFID card key scans, and fingerprint/face verification matching against access grants.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: '0.4rem' }}>
                  <strong>Modes &amp; Signals:</strong> Unlocks on grant (Green LED, `locks/{'{id}'}/command`), denies unauthorized attempts (Red LED), reports battery % and 30s heartbeat (Green/Gray status badge).
                </div>
              </div>

              {/* Punching Terminals */}
              <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Fingerprint size={18} color="#10b981" /> Biometric Punching Terminals
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  Staff attendance terminals. Scans fingerprint or face to verify identity, logs attendance punch (`IN` / `OUT`), and records access audit trail.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: '0.4rem' }}>
                  <strong>Modes &amp; Signals:</strong> "Verify &amp; Log" mode. Emits Green signal on match and inserts attendance log; records audit trail for failed attempts.
                </div>
              </div>

              {/* Controllable Space Equipment */}
              <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={18} color="#f59e0b" /> Space Power Equipment (Lamps, Fans, ACs)
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  Space power switches &amp; climate control units. Managed individually or via Space / Org Master Switches.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: '0.4rem' }}>
                  <strong>Modes &amp; Signals:</strong> Capability `on_off`. Displays Green glow for ON state, Red glow for OFF state, and tracks live wattage (15W to 1500W).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
