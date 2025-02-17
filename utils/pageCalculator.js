function divideAndRoundUp(a, b) {
    let num1 = Number(a)
    let num2 = Number(b)
    const result = Math.floor(num1 / num2);
    if (num1 % num2 !== 0) {
        return result + 1;
    }
    return result;
}

module.exports = { divideAndRoundUp };
