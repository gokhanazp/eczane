document.addEventListener('DOMContentLoaded', function() {
    function getTodayDate() {
        const today = new Date();

        // Gün, Ay ve Yıl bilgilerini al
        const day = today.getDate();
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const month = months[today.getMonth()];
        const year = today.getFullYear();

        // Haftanın günü bilgisi
        const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const weekday = weekdays[today.getDay()];

        // İstenilen formatta birleştir
        const formattedDate = `${day} ${month} ${year} ${weekday} Günü`;

        // HTML elementini bul ve tarih bilgisini yazdır
        const dateElement = document.getElementById('today-date');
        if (dateElement) {
            dateElement.textContent = formattedDate;
        } else {
            console.error("Element with id 'today-date' not found.");
        }
    }

    getTodayDate();
});