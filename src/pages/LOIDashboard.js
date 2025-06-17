import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from './LOIDashboard.module.css';
import { useNavigate } from 'react-router-dom';
import { BarChartBig, RefreshCcw } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Title);
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// a single axios instance, pointing straight at your backend:
const api = axios.create({
  baseURL: `${API_URL}/api`,
});


function LOIDashboard({ user }) {
  const navigate = useNavigate(); 
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [weekStats, setWeekStats] = useState({});
  
  // at the top of LOIDashboard(), right after your other useState calls:
const [editingWorkflowFor, setEditingWorkflowFor] = useState(null);
  const [refreshingContracts, setRefreshingContracts] = useState({});
  const [filters, setFilters] = useState({
    workflowStatus: '',
    tenantType: '',
    status: '',
    search: '',
    leadStatus: ''  // ← new
  });
  const [leadStatuses, setLeadStatuses] = useState({});
  const handleLogout = () => {
   localStorage.removeItem('user');
   navigate('/login', { replace: true });
 };

 const [showExplorer, setShowExplorer] = useState(false);
const [contractsFolderFiles, setContractsFolderFiles] = useState([]);
const [processedFolderFiles, setProcessedFolderFiles] = useState([]);

  const [exportFrom, setExportFrom] = useState(''); // e.g. "2025-06-01"
const [exportTo, setExportTo] = useState('');     // e.g. "2025-06-10"
    // ─── New state hooks for “export from/to” ─────────────────────────────────
    const [exportFromRaw, setExportFromRaw] = useState('');
    const [exportToRaw, setExportToRaw] = useState('');

    // ─── New state for “Start Auto Processing” ───────────────────────────────────
    const [loadingAuto, setLoadingAuto] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorAuto, setErrorAuto] = useState(null);
    const [sharepointPath, setSharepointPath] = useState('');


  // ─── Failsafe states ─────────────────────────────────────────────────────────
  // Prevent double-start
  const [isProcessingAuto, setIsProcessingAuto] = useState(false);
  // Track online/offline
   const [isOnline, setIsOnline] = useState(navigator.onLine);
   
   useEffect(() => {
    if (!showExplorer) return;
    api.get('/list-files?folder=contracts').then(res => setContractsFolderFiles(res.data.files));
    api.get('/list-files?folder=processed').then(res => setProcessedFolderFiles(res.data.files));
  }, [showExplorer]);

   useEffect(() => {
    // Fetch contracts + lead statuses
    const fetchData = async () => {
      try {
        const res = await api.get('/get-compare-results');
        if (res.data.success && Array.isArray(res.data.data)) {
          const rawContracts = res.data.data;
          setContracts(rawContracts);
          setFilteredContracts(rawContracts);
          computeWeeklyStats(rawContracts);
        }
  
        const leadRes = await api.get('/get-lead-statuses');
        if (leadRes.data.success && leadRes.data.statuses) {
          setLeadStatuses(leadRes.data.statuses);
        }
  
        // If we got here, we’re online
        setIsOnline(true);
        setErrorAuto(null);
      } catch (err) {
        console.error('❌ Failed to fetch compare_result data:', err);
        // If the error is due to network, mark offline
        if (!navigator.onLine) {
          setIsOnline(false);
        }
      }
    };
  
    // Initial load
    fetchData();
  
    // Retry when back online
    const handleOnline = () => {
      setIsOnline(true);
      fetchData();
    };
  
    // Mark offline immediately on disconnect
    const handleOffline = () => setIsOnline(false);
  
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); 

  useEffect(() => {
    applyFilters();
  }, [filters, contracts]);

  const applyFilters = () => {
    let filteredData = contracts;
    if (filters.search) {
      filteredData = filteredData.filter(contract => 
        contract.contract_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
        contract.workflow_status?.toLowerCase().includes(filters.search.toLowerCase()) ||
        contract.tenant_type?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    if (filters.workflowStatus) {
      filteredData = filteredData.filter(contract => contract.workflow_status === filters.workflowStatus);
    }
    if (filters.tenantType) {
      filteredData = filteredData.filter(contract => contract.tenant_type === filters.tenantType);
    }
    if (filters.status) {
      filteredData = filteredData.filter(contract => isValid(contract) === (filters.status === 'Passed'));
    }
    if (filters.leadStatus) {
      filteredData = filteredData.filter(
        c => (leadStatuses[c.contract_number] || '') === filters.leadStatus
      );
    }
  
    setFilteredContracts(filteredData);
  };

  const toggleDetails = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const isValid = (item) => {
    const validationValid = Array.isArray(item.validation_result)
      ? item.validation_result.every(row => row.valid === true)
      : false;
    const compareValid = Array.isArray(item.compare_result)
      ? item.compare_result.every(row => row.match === true)
      : false;
    return validationValid && compareValid;
  };

  const computeWeeklyStats = (contracts) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    const countByDay = {
      Sunday: 0, Monday: 0, Tuesday: 0,
      Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0
    };

    contracts.forEach(c => {
      const date = c.timestamp?.toDate?.() || new Date(c.timestamp);
      if (date >= weekStart) {
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        countByDay[day]++;
      }
    });

    setWeekStats(countByDay);
  };

  const passedCount = filteredContracts.filter(c => isValid(c)).length;
  const reviewCount = filteredContracts.length - passedCount;

  const handleExport = () => {
    // 1) Parse “from” / “to” into Date objects
    let fromDate = null,
        toDate   = null;
    if (exportFromRaw) {
      fromDate = new Date(exportFromRaw);
      fromDate.setHours(0,0,0,0);
    }
    if (exportToRaw) {
      toDate = new Date(exportToRaw);
      toDate.setHours(23,59,59,999);
    }
  
    // 2) Filter contracts by that range
    const inRange = filteredContracts.filter(contract => {
      const ts = contract.timestamp;
      let actualDate = null;
  
      // Firestore Timestamp?
      if (ts && typeof ts.toDate === 'function') {
        actualDate = ts.toDate();
      }
      // plain JSON _seconds?
      else if (ts && ts._seconds != null) {
        actualDate = new Date(ts._seconds * 1000 + (ts._nanoseconds||0)/1e6);
      }
      // seconds/nanoseconds variant?
      else if (ts && ts.seconds != null) {
        actualDate = new Date(ts.seconds * 1000 + (ts.nanoseconds||0)/1e6);
      }
      // fallback
      else {
        actualDate = new Date(ts);
      }
  
      if (!actualDate || isNaN(actualDate.getTime())) return false;
      if (fromDate && actualDate < fromDate) return false;
      if (toDate   && actualDate > toDate)   return false;
      return true;
    });
  
    // 3) Strip out big fields & format timestamp
    const cleaned = inRange.map(contract => {
      const {
        pdf_extracted,
        web_extracted,
        compare_result,
        validation_result,
        web_validation_result,
        meter_validation_result,
        gemini_output,
        popup_url,
        ...keep
      } = contract;
  
      return {
        ...keep,
        timestamp: formatDate(contract.timestamp),
      };
    });
  
    // 4) Generate & download the XLSX
    const ws = XLSX.utils.json_to_sheet(cleaned);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    XLSX.writeFile(
      wb,
      `contracts_${exportFromRaw || 'start'}_${exportToRaw || 'end'}.xlsx`
    );
  };

  // 1. create exportBetween(fromRaw, toRaw) helper
const exportBetween = (fromRaw, toRaw) => {
  console.log('▶️ exportBetween fromRaw:', fromRaw);
  console.log('▶️ exportBetween toRaw:  ', toRaw);

  let fromDate = null, toDate = null;
  if (fromRaw) {
    fromDate = new Date(fromRaw);
    fromDate.setHours(0, 0, 0, 0);
  }
  if (toRaw) {
    toDate = new Date(toRaw);
    toDate.setHours(23, 59, 59, 999);
  }
  console.log('▶️ exportBetween parsed fromDate:', fromDate);
  console.log('▶️ exportBetween parsed toDate:  ', toDate);

  const inRange = filteredContracts.filter(contract => {
    const ts = contract.timestamp;
    console.log(`  • [${contract.contract_number}] raw timestamp:`, ts);

    let actualDate = null;
    if (ts && ts._seconds != null) {
      // Firestore‐style JSON
      actualDate = new Date(ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6);
    } else if (ts && ts.seconds != null) {
      // plain “seconds” variant
      actualDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6);
    } else {
      actualDate = new Date(ts);
    }

    console.log('    → parsed actualDate:', actualDate);
    if (isNaN(actualDate.getTime())) {
      console.warn(`    ❌ [${contract.contract_number}] invalid Date → excluded`);
      return false;
    }
    if (fromDate && actualDate < fromDate) {
      console.warn(`    ❌ [${contract.contract_number}] before fromDate → excluded`);
      return false;
    }
    if (toDate && actualDate > toDate) {
      console.warn(`    ❌ [${contract.contract_number}] after toDate → excluded`);
      return false;
    }
    return true;
  });

  console.log('▶️ exportBetween in-range count:', inRange.length);

  const cleaned = inRange.map(contract => {
    const {
      pdf_extracted,
      web_extracted,
      compare_result,
      validation_result,
      web_validation_result,
      meter_validation_result,
      gemini_output,
      popup_url,
      ...keep
    } = contract;
    return {
      ...keep,
      timestamp: formatDate(contract.timestamp),
    };
  });

  const ws = XLSX.utils.json_to_sheet(cleaned);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
  XLSX.writeFile(wb, 'contracts.xlsx');
};

  const handleLeadStatusChange = async (contractId, status) => {
    setLeadStatuses(prev => ({ ...prev, [contractId]: status }));
    try {
       await api.post('/update-lead-status', {
           contractNumber: contractId.replace(/_/g, '/'),
           leadStatus: status,
         });
      console.log(`[✅ Lead status for ${contractId} updated to ${status}`);
    } catch (error) {
      console.error(`[❌ Error updating lead status for ${contractId}]`, error);
    }
  };

  const forceProcessFile = async (contractNumber) => {
    try {
      const res = await api.post(`/force-process-contract`, {
        contractNumber
      });
  
      if (res.data.success) {
        alert('✅ Forced processing complete.');
  
        // Re-fetch the latest compare results and refresh state
        const { data } = await api.get('/get-compare-results');
        if (data.success && Array.isArray(data.data)) {
          setContracts(data.data);
          setFilteredContracts(data.data);
          computeWeeklyStats(data.data);
        }
      } else {
        alert('❌ Failed to start forced process.');
      }
    } catch (err) {
      alert('❌ Error during forced process.');
      console.error(err);
    }
  };

  const autoProcessContracts = async () => {
    // Start both loading and processing flags
    setIsProcessingAuto(true);
    setLoadingAuto(true);
    setErrorAuto(null);
    setSuccessMessage(null);
  
    try {
      // Trigger backend auto-process
      const res = await api.post(
        `/auto-process-pdf-folder`,
        { folderPath: sharepointPath }
      );
  
      if (res.data.success) {
        const count = res.data.processedCount || 0;
        const msg = `✅ Auto processing started: ${count} file(s) processed.`;
        setSuccessMessage(msg);
        alert(msg);
      } else {
        const errMsg = '⚠️ No new files found or nothing was processed.';
        setErrorAuto(errMsg);
        alert(errMsg);
      }
    } catch (err) {
      console.error('[Auto Processing Error]', err);
      let errMsg;
  
      if (!navigator.onLine) {
        errMsg = '❌ Network offline — will retry when you’re back online.';
      } else if (err.response?.status === 404) {
        errMsg = '❌ Endpoint not found: /api/auto-process-pdf-folder. Please check your backend route.';
      } else if (err.response?.status === 500) {
        errMsg = '❌ Server error occurred. Please try again later.';
      } else {
        errMsg = `❌ Unexpected error: ${err.message}`;
      }
  
      setErrorAuto(errMsg);
      alert(errMsg);
    } finally {
      // Clear flags
      setLoadingAuto(false);
      setIsProcessingAuto(false);
    }
  };

  // Inside LOIDashboard(), after handleExport:
// ─── “Today’s Report” handler ─────────────────────────────────────────────────
// 3. modify handleTodaysReport to compute “YYYY-MM-DD” and call exportBetween(...)
const handleTodaysReport = () => {
  // compute today’s date as “YYYY-MM-DD”
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1)
  .padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayString = `${yyyy}-${mm}-${dd}`;

  // directly call exportBetween with todayString
  exportBetween(todayString, todayString);
};

  const handleWorkflowStatusChange = async (contractNumber, chosenStatus) => {
    // If the user didn’t actually select anything (empty string), do nothing
    if (!chosenStatus) {
      return;
    }
  
    // 1. Confirm with the user before sending
    const confirmed = window.confirm(
      `Are you sure you want to change ${contractNumber} → "${chosenStatus}"?`
    );
    if (!confirmed) {
      return;
    }
  
    // 2. Send to backend
    try {
      await api.post('/update-workflow-status', {
        contractNumber,
        workflowStatus: chosenStatus
      });
  
      // 3. Update local state immediately so UI reflects it
      setContracts(prev =>
        prev.map(c =>
          c.contract_number === contractNumber
            ? { ...c, workflow_status: chosenStatus }
            : c
        )
      );
      setFilteredContracts(prev =>
        prev.map(c =>
          c.contract_number === contractNumber
            ? { ...c, workflow_status: chosenStatus }
            : c
        )
      );
  
      alert(`✅ Workflow status for ${contractNumber} changed to "${chosenStatus}".`);
    } catch (err) {
      console.error(`❌ Error updating workflow status for ${contractNumber}:`, err);
      alert('❌ Failed to update Workflow Status. See console for details.');
    }
  };

  // Helper to format Firestore timestamp (or plain JS Date) as "DD-MMM-YYYY"
// ─── Revised formatDate helper ──────────────────────────────────
// Converts Firestore Timestamp (or plain object with .seconds) or JS Date/string
// into "DD-MMM-YYYY". Returns '—' if invalid/absent.
// ─── Updated formatDate (handles ts.toDate(), ts.seconds, or ts._seconds) ──────────────────────────
const formatDate = (ts) => {
  if (!ts) return '—';

  let d;

  // A) Firestore Timestamp instance (has toDate()):
  if (typeof ts.toDate === 'function') {
    d = ts.toDate();

  // B) Plain object form from Firestore (could use .seconds or ._seconds):
  } else if (ts.seconds !== undefined) {
    d = new Date(ts.seconds * 1000);
  } else if (ts._seconds !== undefined) {
    d = new Date(ts._seconds * 1000);

  // C) Already a JS‐Date or an ISO‐string:
  } else {
    d = new Date(ts);
  }

  if (isNaN(d.getTime())) {
    return '—';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getContractDate = (ts) => {
  if (!ts) return null;
  // If it's a Firestore Timestamp object with toDate()
  if (typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  // If it's stored as { seconds, nanoseconds }
  if (ts.seconds != null && ts.nanoseconds != null) {
    return new Date(ts.seconds * 1000 + ts.nanoseconds / 1e6);
  }
  // Fallback: try the Date constructor directly
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
};

// ───────────────────────────────────────────────────────────────────────────────────────────────

  const refreshContractStatus = async (contractNumber) => {
    // show spinner on that row
    setRefreshingContracts(prev => ({ ...prev, [contractNumber]: true }));
  
    try {
       const { data } = await api.post(
           '/refresh-contract-status',
           { contractNumber }
         );
  
      // if your API ever returns success: false, bubble it up
      if (!data.success) {
        throw new Error(data.message || 'Unknown error');
      }
  
      const newStatus = data.status; // e.g. "Accepted", "Pending"...
  
      // update the one contract in our state
      setContracts(old =>
        old.map(c =>
          c.contract_number === contractNumber
            ? { ...c, workflow_status: newStatus }
            : c
        )
      );
  
      alert(`🔄 Status updated to "${newStatus}"`);
    } catch (err) {
      console.error(
        '❌ refresh-contract-status failed:',
        err.response?.data ?? err.message
      );
      alert(
        `❌ Failed to refresh contract status:\n${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      // hide spinner
      setRefreshingContracts(prev => ({ ...prev, [contractNumber]: false }));
    }
  };


  
  return (
    <div className={styles.dashboardWrapper}>
      {/* File Explorer Button */}
      <div className={styles.dashboardWrapper}>
      {/* … existing buttons/filters … */}



      {showExplorer && (
        <FileExplorer onClose={() => setShowExplorer(false)} />
      )}

      <table className={styles.resultTable}>
        {/* … rest of your table … */}
      </table>
    </div>
  {/* ─── Logout button ─────────────────────────────────────────────────── */}
  <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
    <button className={styles.logoutButton} onClick={handleLogout}>
      Logout
    </button>
  </div>

  {/* ─── “Start Auto Processing” button (for super_user or admin) ───────────────── */}
{(user?.role === 'super_user' || user?.role === 'admin') && (
  <div style={{ marginBottom: '1rem' }}>
<button
  className={styles.button_autoprocess}
  onClick={() => {
    if (isProcessingAuto) {
      return alert('⚠️ A process is already running. Please wait.');
    }
    if (!isOnline) {
      return alert('⚠️ You appear offline. Will resume when you’re back online.');
    }
    autoProcessContracts();
  }}
  disabled={loadingAuto || !isOnline}
>
  {loadingAuto ? '⏳ Processing…' : '⚙️ Start Auto Processing'}
</button>
    {successMessage && (
      <span style={{ marginLeft: '1rem', color: 'green' }}>
        {successMessage}
      </span>
    )}
    {errorAuto && (
      <span style={{ marginLeft: '1rem', color: 'red' }}>
        {errorAuto}
      </span>
    )}
  </div>
)}

  <div className={styles.dashboardTitle}>
    <BarChartBig size={20} /> LOI Auto Check Dashboard
  </div>

      <div className={styles.kpiWrapper}>
        <div className={styles.kpiCard}>
          <h3>✅ Passed</h3>
          <div className={styles.kpiCardValue}>{filteredContracts.length > 0 ? passedCount : 0}</div>
        </div>
        <div className={styles.kpiCard}>
          <h3>❌ Needs Review</h3>
          <div className={styles.kpiCardValue}>{filteredContracts.length > 0 ? reviewCount : 0}</div>
        </div>
      </div>

      {/* ─── Filters + Date‐range + Export button ─────────────────────────────────── */}
<div className={styles.filtersWrapper}>
  <input
    type="text"
    placeholder="Search by Contract Number, Status, or Tenant Type"
    value={filters.search}
    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
  />
  <select onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
    <option value="">Select Status</option>
    <option value="Passed">Passed</option>
    <option value="Needs Review">Needs Review</option>
  </select>
  <select onChange={e => setFilters(prev => ({ ...prev, workflowStatus: e.target.value }))}>
    <option value="">Select Workflow Status</option>
    <option value="Accepted">Accepted</option>
    <option value="In Progress">In Progress</option>
    <option value="Pending">Pending</option>
  </select>
  <select onChange={e => setFilters(prev => ({ ...prev, tenantType: e.target.value }))}>
    <option value="">Select Tenant Type</option>
    <option value="PND - PN Financial Service - ATM">PND - PN Financial Service - ATM</option>
    <option value="Commercial">Commercial</option>
  </select>

  <select
    value={filters.leadStatus}
    onChange={e => setFilters(prev => ({ ...prev, leadStatus: e.target.value }))}
  >
    <option value="">Select Lead Status</option>
    <option value="Acknowledge">Acknowledge</option>
    <option value="In-progress">In-progress</option>
    <option value="Resolved">Resolved</option>
  </select>

  {/* ─── New “From” / “To” date pickers ───────────────────────────────────────── */}
    {/* ─── “From” / “To” date pickers ───────────────────────────────────────────── */}
{/* ─── “From” / “To” date pickers + Export button ─────────────────────────── */}
{/* ─── “From” / “To” date pickers + Export buttons ─────────────────────────── */}
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  <label>
    From:&nbsp;
    <input
      type="date"
      value={exportFromRaw}
      onChange={e => setExportFromRaw(e.target.value)}
      style={{ height: '1.5rem' }}
    />
  </label>
  <label>
    To:&nbsp;
    <input
      type="date"
      value={exportToRaw}
      onChange={e => setExportToRaw(e.target.value)}
      style={{ height: '1.5rem' }}
    />
  </label>
  <button
    onClick={handleExport}
    style={{ height: '2rem', marginBottom: '1rem' }}

  >
    Export to Excel
  </button>
  <button
    onClick={handleTodaysReport}
    style={{ height: '2rem', marginBottom: '1rem' }}

  >
    Today’s Report
  </button>

  <button
    onClick={() => setShowExplorer(true)}
    title="Open File Explorer"
    style={{
      height: '2rem',
      width: '2rem',
      padding: 0,
      fontSize: '2.2rem',
      lineHeight: 1,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      border: 'none',
      marginBottom: '0.5rem',
    }}
  >
    📂
  </button>
</div>
</div>

      <table className={styles.resultTable}>
  <thead>
    <tr>
      <th>Contract</th>
      <th>Timestamp</th>
      <th>Status</th>
      <th>Workflow Status</th>
      <th>Lease Type</th>
      <th>Tenant Type</th>
      <th>Lead Status</th>
      <th>Summary</th>
      {user?.role !== 'user' && <th>Force Process</th>}
    </tr>
  </thead>
  <tbody>
  {(() => {
    const activeContracts = filteredContracts.filter(
      c => (leadStatuses[c.contract_number] || '').toLowerCase() !== 'resolved'
    );
    const resolvedContracts = filteredContracts.filter(
      c => (leadStatuses[c.contract_number] || '').toLowerCase() === 'resolved'
    );

    

    return (
      <>
        {/* Active rows */}
        {activeContracts.map((contract, idx) => {
          const status = isValid(contract) ? '✅ Passed' : '❌ Needs Review';
          const rowId = contract.contract_number || `row-${idx}`;
          return (
            <React.Fragment key={rowId}>
              <tr>
                <td>{contract.contract_number || '—'}</td>
                <td>{formatDate(contract.timestamp)}</td>
                <td>{status}</td>
                <td>
                  {editingWorkflowFor === contract.contract_number ? (
                    <select
                      value={contract.workflow_status || ''}
                      onChange={e => {
                        handleWorkflowStatusChange(contract.contract_number, e.target.value);
                        setEditingWorkflowFor(null);
                      }}
                      onBlur={() => setEditingWorkflowFor(null)}
                      autoFocus
                      className={styles.workflowSelect}
                    >
                      <option value="">-- select status --</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Reject">Reject</option>
                      <option value="Pending">Pending Verification</option>
                      <option value="Simplify need editing">Simplify need editing</option>
                      <option value="LOI need editing">LOI need editing</option>
                    </select>
                  ) : (
                    <>
                      {contract.workflow_status || '—'}
                      {refreshingContracts[contract.contract_number] ? (
                        <span className={styles.spinner} />
                      ) : (
                        <button
                          className={styles.refreshIconButton}
                          title="Refresh Status"
                          onClick={() => refreshContractStatus(contract.contract_number)}
                        >
                          <RefreshCcw size={14} />
                        </button>
                      )}
                      <button
                        className={styles.editWorkflowButton}
                        title="Edit Workflow Status"
                        onClick={() => setEditingWorkflowFor(contract.contract_number)}
                      >
                        ✏️
                      </button>
                    </>
                  )}
                </td>
                <td>{contract.lease_type || '—'}</td>
                <td>{contract.tenant_type || '—'}</td>
                <td>
                  <select
                    value={leadStatuses[contract.contract_number] || ''}
                    onChange={e => handleLeadStatusChange(contract.contract_number, e.target.value)}
                    className={styles.leadStatusSelect}
                  >
                    <option value="">Select Lead Status</option>
                    <option value="Acknowledge">Acknowledge</option>
                    <option value="In-progress">In-progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </td>
                <td>
                  <button
                    className={styles.expandButton}
                    onClick={() => toggleDetails(rowId)}
                  >
                    {expandedId === rowId ? 'Hide' : 'View Details'}
                  </button>
                </td>
                {user?.role !== 'user' && (
                  <td>
                    <button
                      className={styles.forceProcessButton}
                      onClick={() => {
                        if (isProcessingAuto) {
                          alert('⚠️ A process is already running. Please wait.');
                          return;
                        }
                        forceProcessFile(contract.contract_number);
                      }}
                      disabled={isProcessingAuto}
                    >
                      🚀 Force Process
                    </button>
                  </td>
                )}
              </tr>
              {expandedId === rowId && (
            <tr>
              <td colSpan={9}>
                <div className={styles.detailsSection}>
                  <h4>🔍 Compare Result</h4>
                  <table className={styles.detailsTable}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>PDF</th>
                        <th>Web</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(contract.compare_result || []).map((row, i) => (
                        <tr key={i}>
                          <td>{row.field}</td>
                          <td>{row.pdf}</td>
                          <td>{row.web}</td>
                          <td>{row.match ? '✅' : '❌'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>🧠 PDF Validation Result</h4>
                  <table className={styles.detailsTable}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Value</th>
                        <th>Valid</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(contract.validation_result || []).map((row, i) => (
                        <tr key={i}>
                          <td>{row.field}</td>
                          <td>{row.value}</td>
                          <td>{row.valid ? '✅' : '❌'}</td>
                          <td>{row.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>🌐 Simplicity Validation Result</h4>
                  <table className={styles.detailsTable}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Value</th>
                        <th>Valid</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(contract.web_validation_result || []).map((row, i) => (
                        <tr key={i}>
                          <td>{row.field}</td>
                          <td>{row.value}</td>
                          <td>{row.valid ? '✅' : '❌'}</td>
                          <td>{row.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {contract.meter_validation_result && contract.meter_validation_result.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                      <h4>🌡 Meter Validation Result</h4>
                      <table className={styles.detailsTable}>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Value</th>
                            <th>Valid</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contract.meter_validation_result.map((row, i) => (
                            <tr key={i}>
                              <td>{row.field}</td>
                              <td>{row.value ?? '—'}</td>
                              <td>{row.valid ? '✅' : '❌'}</td>
                              <td>{row.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
          );
        })}

        {/* Segment breaker */}
        {resolvedContracts.length > 0 && (
          <tr className={styles.segmentBreaker}>
            <td colSpan={user?.role !== 'user' ? 10 : 9}>
              📌 Resolved Contracts
            </td>
          </tr>
        )}

        {/* Resolved rows (greyed out but fully interactive) */}
        {resolvedContracts.map((contract, idx) => {
          const status = isValid(contract) ? '✅ Passed' : '❌ Needs Review';
          const rowId = contract.contract_number || `resolved-${idx}`;
          return (
            <React.Fragment key={rowId}>
              <tr className={styles.resolvedRow}>
                <td>{contract.contract_number || '—'}</td>
                <td>{formatDate(contract.timestamp)}</td>
                <td>{status}</td>
                <td>
                  {editingWorkflowFor === contract.contract_number ? (
                    <select
                      value={contract.workflow_status || ''}
                      onChange={e => {
                        handleWorkflowStatusChange(contract.contract_number, e.target.value);
                        setEditingWorkflowFor(null);
                      }}
                      onBlur={() => setEditingWorkflowFor(null)}
                      autoFocus
                      className={styles.workflowSelect}
                    >
                      <option value="">-- select status --</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Reject">Reject</option>
                      <option value="Pending">Pending Verification</option>
                      <option value="Simplify need editing">Simplify need editing</option>
                      <option value="LOI need editing">LOI need editing</option>
                    </select>
                  ) : (
                    <>
                      {contract.workflow_status || '—'}
                      {refreshingContracts[contract.contract_number] ? (
                        <span className={styles.spinner} />
                      ) : (
                        <button
                          className={styles.refreshIconButton}
                          title="Refresh Status"
                          onClick={() => refreshContractStatus(contract.contract_number)}
                        >
                          <RefreshCcw size={14} />
                        </button>
                      )}
                      <button
                        className={styles.editWorkflowButton}
                        title="Edit Workflow Status"
                        onClick={() => setEditingWorkflowFor(contract.contract_number)}
                      >
                        ✏️
                      </button>
                    </>
                  )}
                </td>
                <td>{contract.lease_type || '—'}</td>
                <td>{contract.tenant_type || '—'}</td>
                <td>
                  <select
                    value={leadStatuses[contract.contract_number] || ''}
                    onChange={e => handleLeadStatusChange(contract.contract_number, e.target.value)}
                    className={styles.leadStatusSelect}
                  >
                    <option value="">Select Lead Status</option>
                    <option value="Acknowledge">Acknowledge</option>
                    <option value="In-progress">In-progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </td>
                <td>
                  <button
                    className={styles.expandButton}
                    onClick={() => toggleDetails(rowId)}
                  >
                    {expandedId === rowId ? 'Hide' : 'View Details'}
                  </button>
                </td>
                {user?.role !== 'user' && (
                  <td>
                    <button
                      className={styles.forceProcessButton}
                      onClick={() => {
                        if (isProcessingAuto) {
                          alert('⚠️ A process is already running. Please wait.');
                          return;
                        }
                        forceProcessFile(contract.contract_number);
                      }}
                      disabled={isProcessingAuto}
                    >
                      🚀 Force Process
                    </button>
                  </td>
                )}
              </tr>
              {expandedId === rowId && (
                <tr className={styles.resolvedRow}>
                  <td colSpan={user?.role !== 'user' ? 10 : 9}>
                    <div className={styles.detailsSection}>
                      {/* …details content… */}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  })()}
</tbody>
</table>
    </div>
  );
}

function FileExplorer({ onClose }) {
  const [tree, setTree] = useState([]);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    fetchTree('');
  }, []);

  const fetchTree = async (path) => {
    try {
      const res = await api.get('/list-directory', { params: { path } });
      let entries = res.data.entries;
      // At root, only show these two folders:
      if (path === '') {
        entries = entries.filter(e =>
          e.isDirectory && ['contracts', 'processed'].includes(e.name)
        );
      }
      setTree(entries);
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to list directory:', err);
    }
  };

  const enter = (entry) => {
    if (!entry.isDirectory) return;
    const next = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    fetchTree(next);
  };

  const downloadFile = (entry) => {
    const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    window.open(
      `${API_URL}/api/download-file?path=${encodeURIComponent(filePath)}`,
      '_blank'
    );
  };

  const downloadFolder = () => {
    window.open(
      `${API_URL}/api/download-folder?path=${encodeURIComponent(currentPath)}`,
      '_blank'
    );
  };

  // new: upload handler
  const uploadFiles = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const form = new FormData();
    for (let file of files) {
      form.append('files', file);
    }
    try {
      await api.post('/upload-file', form, {
        params: { path: currentPath },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTree(currentPath); // refresh view
      e.target.value = ''; // reset input
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload files');
    }
  };

  // new: delete handler
  const deleteEntry = async (entry) => {
    const target = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (!window.confirm(`Delete "${entry.name}"?`)) return;
    try {
      await api.delete('/delete-entry', { params: { path: target } });
      fetchTree(currentPath);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete entry');
    }
  };

  // Breadcrumb segments
  const crumbs = currentPath === ''
    ? []
    : currentPath.split('/').map((seg, i, arr) => ({
        name: seg,
        path: arr.slice(0, i + 1).join('/')
      }));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.explorerHeader}>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
          <nav className={styles.breadcrumb}>
            <span
              className={styles.crumb}
              onClick={() => fetchTree('')}
            >
              Home
            </span>
            {crumbs.map(c => (
              <React.Fragment key={c.path}>
                <span className={styles.separator}>/</span>
                <span
                  className={styles.crumb}
                  onClick={() => fetchTree(c.path)}
                >
                  {c.name}
                </span>
              </React.Fragment>
            ))}
          </nav>
          <button
            className={styles.downloadFolderBtn}
            onClick={downloadFolder}
          >
            ↓ Download Folder
          </button>
          {/* new: upload button */}
          <label className={styles.uploadLabel}>
            ↑ Upload
            <input
              type="file"
              multiple
              onChange={uploadFiles}
              className={styles.uploadInput}
            />
          </label>
        </div>

        {/* File/Folder List */}
        <ul className={styles.fileList}>
          {tree.map(entry => (
            <li
              key={entry.name}
              className={entry.isDirectory ? styles.dirItem : styles.fileItem}
              onDoubleClick={() =>
                entry.isDirectory ? enter(entry) : downloadFile(entry)
              }
            >
              {entry.isDirectory ? '📁' : '📄'} {entry.name}
              <div className={styles.entryActions}>
                {!entry.isDirectory && (
                  <button
                    className={styles.downloadBtn}
                    onClick={e => { e.stopPropagation(); downloadFile(entry); }}
                  >
                    ↓
                  </button>
                )}
                <button
                  className={styles.deleteBtn}
                  onClick={e => { e.stopPropagation(); deleteEntry(entry); }}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


export default LOIDashboard;