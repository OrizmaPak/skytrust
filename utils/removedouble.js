function removedouble(arr, uniqueKey, countKey = null, sumKey = null) {
    const map = new Map();

    arr.forEach(item => {
        const key = item[uniqueKey];

        if (map.has(key)) {
            // Update the count if countKey is provided
            if (countKey) {
                map.get(key)[countKey] += 1;
            }

            // Update the sum if sumKey is provided
            if (sumKey) {
                map.get(key)[sumKey] += item[sumKey];
            }
        } else {
            // Create a new object in the map
            const newItem = { ...item };
            
            // Initialize countKey if provided
            if (countKey) {
                newItem[countKey] = 1;  // Initialize count as 1
            }

            // Initialize sumKey if provided
            if (sumKey) {
                newItem[sumKey] = item[sumKey];  // Initialize sum with the value
            }

            map.set(key, newItem);
        }
    });

    // Convert the map back to an array of objects
    return Array.from(map.values());
}

module.exports = { removedouble };




