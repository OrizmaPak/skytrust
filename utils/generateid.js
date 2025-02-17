function generateid() {
    const now = new Date();

    const year = now.getFullYear(); // 4-digit year
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month (0-11) + 1, padded to 2 digits
    const day = String(now.getDate()).padStart(2, '0'); // Day of the month, padded to 2 digits
    const hours = String(now.getHours()).padStart(2, '0'); // Hours (0-23), padded to 2 digits
    const minutes = String(now.getMinutes()).padStart(2, '0'); // Minutes (0-59), padded to 2 digits
    const seconds = String(now.getSeconds()).padStart(2, '0'); // Seconds (0-59), padded to 2 digits
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); // Milliseconds (0-999), padded to 3 digits

    return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}

module.exports = {generateid};
