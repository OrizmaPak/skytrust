function calculateExpiryDate(hours) {
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.getTime() + hours * 60 * 60 * 1000);
    return expiryDate;
}

function isPastDate(date) {
    const currentDate = new Date();
    const inputDate = new Date(date);

    return inputDate > currentDate;
}

// Adjust the dates by adding one day
const addOneDay = (dateStr) => {
    const dateObj = new Date(dateStr);
    dateObj.setDate(dateObj.getDate() + 1);
    return dateObj.toISOString().split('T')[0]; // Return the date part in 'YYYY-MM-DD' format
};

module.exports = {
    calculateExpiryDate,
    isPastDate,
    addOneDay
};
