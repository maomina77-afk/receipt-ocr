function saveToExcel(items) {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ["品名", "数量", "金額"]
  ];

  items.forEach(item => {
    wsData.push([item.name, item.qty, item.price]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "レシート");

  XLSX.writeFile(wb, "receipt.xlsx");

  alert("Excelに保存しました！");
}
