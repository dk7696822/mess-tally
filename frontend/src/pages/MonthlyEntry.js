import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "react-query";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { PlusIcon, TrashIcon, DocumentArrowDownIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "../components/LoadingSpinner";
import { monthlyDataAPI } from "../utils/api";

export default function MonthlyEntry({ user, onLogout }) {
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [entries, setEntries] = useState([
    {
      id: 1,
      itemName: "",
      unit: "kg",
      previousMonth: [{ qty: "", rate: "", amount: "" }],
      receivedThisMonth: [{ qty: "", rate: "", amount: "" }],
      consumedThisMonth: [{ qty: "", rate: "", amount: "" }],
      nextMonthBalance: [{ qty: "", rate: "", amount: "" }],
    },
  ]);

  const [expandedItems, setExpandedItems] = useState(new Set()); // Track which items are expanded, all collapsed by default
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemIndex: null, itemName: "" }); // Delete confirmation modal state
  const [isDeleting, setIsDeleting] = useState(false); // Track delete operation state

  // Toggle expand/collapse for an item
  const toggleItemExpansion = (index) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Open delete confirmation modal
  const openDeleteModal = (index, itemName) => {
    setDeleteModal({
      isOpen: true,
      itemIndex: index,
      itemName: itemName || `Item ${index + 1}`,
    });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, itemIndex: null, itemName: "" });
  };

  // Confirm delete item
  const confirmDeleteItem = async () => {
    if (deleteModal.itemIndex !== null && !isDeleting) {
      setIsDeleting(true);
      await removeEntry(deleteModal.itemIndex);
      setIsDeleting(false);
      closeDeleteModal();
    }
  };

  // Query for loading saved data
  const { data: savedData, refetch: refetchData } = useQuery(
    ["monthly-data", currentPeriod],
    async () => {
      const response = await monthlyDataAPI.get(currentPeriod);
      return response.data;
    },
    {
      enabled: !!currentPeriod,
      onError: (error) => {
        console.error("Error loading data:", error);
        if (error.response?.status === 401) {
          toast.error("Please log in to access this feature");
        }
      },
    }
  );

  // API mutation for saving data
  const saveDataMutation = useMutation(
    async (data) => {
      const response = await monthlyDataAPI.save({
        period: currentPeriod,
        entries: data,
      });
      return response.data;
    },
    {
      onSuccess: () => {
        toast.success("Monthly data saved successfully!");
        // Refetch data to update the UI
        refetchData();
      },
      onError: (error) => {
        console.error("Save error:", error);
        if (error.response?.status === 401) {
          toast.error("Please log in to save data");
        } else {
          toast.error(error.response?.data?.error || "Failed to save data");
        }
      },
    }
  );

  // Load saved data when it's available
  useEffect(() => {
    if (savedData?.success && savedData.entries && savedData.entries.length > 0) {
      setEntries(savedData.entries);
    } else if (savedData?.success && savedData.entries && savedData.entries.length === 0) {
      // Reset to default empty entry when no data is found
      setEntries([
        {
          id: 1,
          itemName: "",
          unit: "kg",
          previousMonth: [{ qty: "", rate: "", amount: "" }],
          receivedThisMonth: [{ qty: "", rate: "", amount: "" }],
          consumedThisMonth: [{ qty: "", rate: "", amount: "" }],
          nextMonthBalance: [{ qty: "", rate: "", amount: "" }],
        },
      ]);
    }
  }, [savedData]);

  // Refetch data when period changes
  useEffect(() => {
    refetchData();
  }, [currentPeriod, refetchData]);

  const calculateAmount = (qty, rate) => {
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    return (q * r).toFixed(2);
  };

  const updateEntry = (entryIndex, section, subIndex, field, value) => {
    setEntries((prev) => {
      const newEntries = [...prev];
      if (field === "itemName") {
        newEntries[entryIndex].itemName = value;
      } else if (field === "unit") {
        newEntries[entryIndex].unit = value;
      } else {
        newEntries[entryIndex][section][subIndex][field] = value;

        // Auto-calculate amount when qty or rate changes
        if (field === "qty" || field === "rate") {
          const qty = field === "qty" ? value : newEntries[entryIndex][section][subIndex].qty;
          const rate = field === "rate" ? value : newEntries[entryIndex][section][subIndex].rate;
          newEntries[entryIndex][section][subIndex].amount = calculateAmount(qty, rate);
        }
      }
      return newEntries;
    });
  };

  const addSubEntry = (entryIndex, section) => {
    setEntries((prev) => {
      const newEntries = [...prev];
      newEntries[entryIndex][section].push({ qty: "", rate: "", amount: "" });
      return newEntries;
    });
  };

  const removeSubEntry = (entryIndex, section, subIndex) => {
    setEntries((prev) => {
      const newEntries = [...prev];
      if (newEntries[entryIndex][section].length > 1) {
        newEntries[entryIndex][section].splice(subIndex, 1);
      }
      return newEntries;
    });
  };

  const addMainEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        itemName: "",
        unit: "kg",
        previousMonth: [{ qty: "", rate: "", amount: "" }],
        receivedThisMonth: [{ qty: "", rate: "", amount: "" }],
        consumedThisMonth: [{ qty: "", rate: "", amount: "" }],
        nextMonthBalance: [{ qty: "", rate: "", amount: "" }],
      },
    ]);
    // New items remain collapsed by default - user can expand if needed
  };

  const removeEntry = async (index) => {
    try {
      // Remove item from local state
      const updatedEntries = entries.filter((_, i) => i !== index);
      setEntries(updatedEntries);

      // Update expanded items state to account for removed item
      setExpandedItems((prev) => {
        const newSet = new Set();
        prev.forEach((expandedIndex) => {
          if (expandedIndex < index) {
            newSet.add(expandedIndex);
          } else if (expandedIndex > index) {
            newSet.add(expandedIndex - 1);
          }
          // Skip the removed index
        });
        return newSet;
      });

      // Save updated data to backend
      await monthlyDataAPI.save({
        period: currentPeriod,
        entries: updatedEntries,
      });

      toast.success("Item deleted successfully!");

      // Refetch data to ensure consistency
      refetchData();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item. Please try again.");

      // Revert the local state change on error
      refetchData();
    }
  };

  const onSubmit = () => {
    saveDataMutation.mutate(entries);
  };

  const exportToExcel = async () => {
    try {
      // Create a new workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Monthly Report ${currentPeriod}`);

      // Define colors
      const colors = {
        previous: "4A90E2", // Blue
        received: "7ED321", // Green
        consumed: "F5A623", // Orange
        balance: "9013FE", // Purple
        gray: "CCCCCC",
        lightGray: "F0F0F0",
        veryLightGray: "FAFAFA",
      };

      // Set column widths
      worksheet.columns = [
        { width: 8 }, // Sl No
        { width: 18 }, // Particulars
        { width: 10 }, // Unit
        { width: 12 }, // Previous Month Qty
        { width: 12 }, // Previous Month Rate
        { width: 15 }, // Previous Month Amount
        { width: 12 }, // Received This Month Qty
        { width: 12 }, // Received This Month Rate
        { width: 15 }, // Received This Month Amount
        { width: 15 }, // Gross Total
        { width: 12 }, // Consumed This Month Qty
        { width: 12 }, // Consumed This Month Rate
        { width: 15 }, // Consumed This Month Amount
        { width: 12 }, // Next Month Balance Qty
        { width: 12 }, // Next Month Balance Rate
        { width: 15 }, // Next Month Balance Amount
      ];

      // Add main header row
      const mainHeaderRow = worksheet.addRow([
        "",
        "",
        "", // Sl No, Particulars, Unit
        "Previous Month",
        "",
        "", // Spans 3 columns
        "Received This Month",
        "",
        "",
        "Gross Total", // Spans 3 columns + gross total
        "Consumed This Month",
        "",
        "", // Spans 3 columns
        "Next Month Balance",
        "",
        "", // Spans 3 columns
      ]);

      // Merge cells for grouped headers
      worksheet.mergeCells("D1:F1"); // Previous Month
      worksheet.mergeCells("G1:I1"); // Received This Month
      worksheet.mergeCells("K1:M1"); // Consumed This Month
      worksheet.mergeCells("N1:P1"); // Next Month Balance

      // Style main header row
      mainHeaderRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Apply colors based on column
        if (colNumber >= 4 && colNumber <= 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.previous } };
        } else if (colNumber >= 7 && colNumber <= 10) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.received } };
        } else if (colNumber >= 11 && colNumber <= 13) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.consumed } };
        } else if (colNumber >= 14 && colNumber <= 16) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.balance } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.gray } };
        }
      });

      // Add sub-header row
      const subHeaderRow = worksheet.addRow(["Sl No", "Particulars", "Unit", "Qty", "Rate", "Amount", "Qty", "Rate", "Amount", "Total", "Qty", "Rate", "Amount", "Qty", "Rate", "Amount"]);

      // Style sub-header row
      subHeaderRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Apply light colors based on column
        if (colNumber >= 4 && colNumber <= 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } }; // Light Blue
        } else if (colNumber >= 7 && colNumber <= 10) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E8" } }; // Light Green
        } else if (colNumber >= 11 && colNumber <= 13) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } }; // Light Orange
        } else if (colNumber >= 14 && colNumber <= 16) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } }; // Light Purple
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.lightGray } };
        }
      });

      // Add data rows
      entries.forEach((entry, index) => {
        // Calculate gross total for this item
        const prevTotal = entry.previousMonth.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const recTotal = entry.receivedThisMonth.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const grossTotal = (prevTotal + recTotal).toFixed(2);

        // For items with multiple sub-entries, create multiple rows
        const maxSubEntries = Math.max(entry.previousMonth.length, entry.receivedThisMonth.length, entry.consumedThisMonth.length, entry.nextMonthBalance.length);

        for (let i = 0; i < maxSubEntries; i++) {
          const prev = entry.previousMonth[i] || { qty: "", rate: "", amount: "" };
          const rec = entry.receivedThisMonth[i] || { qty: "", rate: "", amount: "" };
          const cons = entry.consumedThisMonth[i] || { qty: "", rate: "", amount: "" };
          const next = entry.nextMonthBalance[i] || { qty: "", rate: "", amount: "" };

          const dataRow = worksheet.addRow([
            i === 0 ? index + 1 : "", // Only show sl no on first row
            i === 0 ? entry.itemName : "", // Only show item name on first row
            i === 0 ? entry.unit : "", // Only show unit on first row
            prev.qty || "",
            prev.rate || "",
            prev.amount || "",
            rec.qty || "",
            rec.rate || "",
            rec.amount || "",
            i === 0 ? grossTotal : "", // Only show gross total on first row
            cons.qty || "",
            cons.rate || "",
            cons.amount || "",
            next.qty || "",
            next.rate || "",
            next.amount || "",
          ]);

          // Style data row
          dataRow.eachCell((cell, colNumber) => {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };

            // Apply light background colors to data sections
            if (colNumber >= 4 && colNumber <= 6) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } }; // Light Blue
            } else if (colNumber >= 7 && colNumber <= 10) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E8" } }; // Light Green
            } else if (colNumber >= 11 && colNumber <= 13) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } }; // Light Orange
            } else if (colNumber >= 14 && colNumber <= 16) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } }; // Light Purple
            } else {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.veryLightGray } };
            }
          });
        }
      });

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();

      // Download the file
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monthly-report-${currentPeriod}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Excel file downloaded with colors and formatting!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel file");
    }
  };

  const renderMobileSection = (entry, entryIndex, section, title, bgColor) => {
    return (
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2 px-3 py-2 rounded-t-md" style={{ backgroundColor: bgColor }}>
          {title}
        </div>
        <div className="space-y-2">
          {entry[section].map((subEntry, subIndex) => (
            <div key={subIndex} className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Qty"
                  value={subEntry.qty}
                  onChange={(e) => updateEntry(entryIndex, section, subIndex, "qty", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Rate"
                  value={subEntry.rate}
                  onChange={(e) => updateEntry(entryIndex, section, subIndex, "rate", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={subEntry.amount}
                  onChange={(e) => updateEntry(entryIndex, section, subIndex, "amount", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {entry[section].length > 1 && (
                <div className="flex justify-end">
                  <button onClick={() => removeSubEntry(entryIndex, section, subIndex)} className="p-1 text-red-600 hover:text-red-800 focus:outline-none">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => addSubEntry(entryIndex, section)}
            className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-gray-800 hover:border-gray-400 focus:outline-none"
          >
            <PlusIcon className="h-4 w-4 inline mr-1" />
            Add Row
          </button>
        </div>
      </div>
    );
  };

  const renderSubEntries = (entry, entryIndex, section, title) => {
    return (
      <td className="px-1 py-3 border-r">
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600 mb-1">{title}</div>
          {entry[section].map((subEntry, subIndex) => (
            <div key={subIndex} className="flex items-center space-x-1">
              <input
                type="number"
                step="0.001"
                value={subEntry.qty}
                onChange={(e) => updateEntry(entryIndex, section, subIndex, "qty", e.target.value)}
                className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right"
                placeholder="Qty"
              />
              <input
                type="number"
                step="0.01"
                value={subEntry.rate}
                onChange={(e) => updateEntry(entryIndex, section, subIndex, "rate", e.target.value)}
                className="w-12 text-xs border border-gray-300 rounded px-1 py-1 text-right"
                placeholder="Rate"
              />
              <input value={subEntry.amount} disabled className="w-16 text-xs bg-gray-100 border border-gray-300 rounded px-1 py-1 text-right" placeholder="Amount" />
              <div className="flex space-x-1">
                <button type="button" onClick={() => addSubEntry(entryIndex, section)} className="text-green-600 hover:text-green-900" title="Add sub-entry">
                  <PlusIcon className="h-3 w-3" />
                </button>
                {entry[section].length > 1 && (
                  <button type="button" onClick={() => removeSubEntry(entryIndex, section, subIndex)} className="text-red-600 hover:text-red-900" title="Remove sub-entry">
                    <TrashIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </td>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mess Tally</h1>
              <p className="text-sm text-gray-600 mt-1">Monthly Inventory - {currentPeriod}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-start sm:items-center">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  Welcome, <strong>{user?.name}</strong>
                </span>
                <span className="text-gray-400">|</span>
                <span className="capitalize">{user?.role}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Export Excel
                </button>
                <button
                  onClick={onSubmit}
                  disabled={saveDataMutation.isLoading}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saveDataMutation.isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : <CheckIcon className="h-4 w-4 mr-2" />}
                  {saveDataMutation.isLoading ? "Saving..." : "Save Data"}
                </button>
                <button
                  onClick={onLogout}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-medium text-gray-900">Monthly Inventory Data</h2>
              <input
                type="month"
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {entries.map((entry, index) => {
              const isExpanded = expandedItems.has(index);
              return (
                <div key={entry.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  {/* Item Header - Always Visible */}
                  <div className="p-4 bg-white border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                          <input
                            value={entry.itemName}
                            onChange={(e) => updateEntry(index, null, null, "itemName", e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Item name"
                          />
                        </div>
                        <select
                          value={entry.unit}
                          onChange={(e) => updateEntry(index, null, null, "unit", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="kg">kg</option>
                          <option value="litre">litre</option>
                          <option value="pieces">pieces</option>
                          <option value="grams">grams</option>
                          <option value="ml">ml</option>
                          <option value="packets">packets</option>
                        </select>
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => toggleItemExpansion(index)}
                          className="p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                          title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                        <button onClick={() => openDeleteModal(index, entry.itemName)} className="p-2 text-red-600 hover:text-red-800 focus:outline-none" title="Delete item">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Details */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {renderMobileSection(entry, index, "previousMonth", "Previous Month", "#E3F2FD")}
                      {renderMobileSection(entry, index, "receivedThisMonth", "Received This Month", "#E8F5E8")}
                      {renderMobileSection(entry, index, "consumedThisMonth", "Consumed This Month", "#FFF3E0")}
                      {renderMobileSection(entry, index, "nextMonthBalance", "Next Month Balance", "#F3E5F5")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r">Sl No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r">Particulars</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r">Unit</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-r">Previous Month</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-r">Received This Month</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-r">Consumed This Month</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-r">Next Month Balance</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry, index) => (
                  <tr key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-3 text-sm text-gray-900 border-r text-center">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">
                      <input
                        value={entry.itemName}
                        onChange={(e) => updateEntry(index, null, null, "itemName", e.target.value)}
                        className="w-full border-none bg-transparent focus:ring-0 p-0"
                        placeholder="Item name"
                      />
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-900 border-r">
                      <select value={entry.unit} onChange={(e) => updateEntry(index, null, null, "unit", e.target.value)} className="w-full border-none bg-transparent focus:ring-0 p-0 text-xs">
                        <option value="kg">kg</option>
                        <option value="litre">litre</option>
                        <option value="pieces">pieces</option>
                        <option value="grams">grams</option>
                        <option value="ml">ml</option>
                        <option value="packets">packets</option>
                      </select>
                    </td>

                    {renderSubEntries(entry, index, "previousMonth", "Previous Month")}
                    {renderSubEntries(entry, index, "receivedThisMonth", "Received This Month")}
                    {renderSubEntries(entry, index, "consumedThisMonth", "Consumed This Month")}
                    {renderSubEntries(entry, index, "nextMonthBalance", "Next Month Balance")}
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => openDeleteModal(index, entry.itemName)} className="p-1 text-red-600 hover:text-red-800 focus:outline-none" title="Delete item">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Item Button */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={addMainEntry}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Enter item names and select units</li>
            <li>• Use + button to add multiple entries for each section</li>
            <li>• Each section can have different rates</li>
            <li>• Amounts are calculated automatically (Qty × Rate)</li>
            <li>• Save your data and export to Excel when ready</li>
          </ul>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Item</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">Are you sure you want to delete "{deleteModal.itemName}"? This action cannot be undone.</p>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteItem}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
