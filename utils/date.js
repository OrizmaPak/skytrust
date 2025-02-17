function getTodayDate() {
    const today = new Date();
  
    // Get the day, month, and year
    const day = String(today.getDate()).padStart(2, '0'); // Day (01-31)
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month (01-12)
    const year = today.getFullYear(); // Year (e.g., 2024)
  
    // Return the date in the format: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  }
  
function getDate30DaysAgo() {
    const today = new Date();
    
    // Subtract 30 days from today's date
    today.setDate(today.getDate() - 30);
  
    // Get the day, month, and year
    const day = String(today.getDate()).padStart(2, '0'); // Day (01-31)
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month (01-12)
    const year = today.getFullYear(); // Year (e.g., 2024)
  
    // Return the date in the format: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  }
  
  console.log(getDate30DaysAgo());
  
module.exports = {
  getTodayDate,
  getDate30DaysAgo
};
  