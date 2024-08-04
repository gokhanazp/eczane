function getTodayDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const formattedDate = today.toLocaleDateString('tr-TR', options); // 'tr-TR' locale for Turkish format
    document.getElementById('today-date').textContent = formattedDate;
}

window.onload = function() {
    getTodayDate();
};