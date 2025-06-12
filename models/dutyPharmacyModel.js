class DutyPharmacyModel {
  constructor(id, name, address, city, district, directions, phone, dutyStart, dutyEnd, latitude, longitude) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.city = city;
    this.district = district;
    this.directions = directions;
    this.phone = phone;
    this.dutyStart = dutyStart;
    this.dutyEnd = dutyEnd;
    this.latitude = latitude;
    this.longitude = longitude;
  }

  static fromJson(json) {
    let phoneRep = json.phone || "";

    // Null/undefined kontrolü ekle
    if (phoneRep && typeof phoneRep === 'string') {
      if (phoneRep.startsWith("0")) {
        phoneRep = `+9${phoneRep}`;
      } else if (phoneRep.startsWith("90")) {
        phoneRep = `+${phoneRep}`;
      } else if (phoneRep.startsWith("+90")) {
        phoneRep = `${phoneRep}`;
      } else {
        phoneRep = `+90${phoneRep}`;
      }
    } else {
      phoneRep = "Telefon bilgisi yok";
    }

    return new DutyPharmacyModel(
      json.pharmacyID || "",
      json.pharmacyName || "Eczane adı belirtilmemiş",
      json.address || "Adres bilgisi yok",
      json.city || "Şehir belirtilmemiş",
      json.district || "İlçe belirtilmemiş",
      json.directions || "Yol tarifi yok",
      phoneRep,
      json.pharmacyDutyStart || "",
      json.pharmacyDutyEnd || "",
      json.latitude || 0,
      json.longitude || 0
    );
  }

  get getLocation() {
    return `${this.latitude}, ${this.longitude}`;
  }
}

module.exports = DutyPharmacyModel;
