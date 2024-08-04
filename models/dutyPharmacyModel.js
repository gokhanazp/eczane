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
    let phoneRep = json.phone;
    if (phoneRep.startsWith("0")) {
      phoneRep = `+9${phoneRep}`;
    } else if (phoneRep.startsWith("90")) {
      phoneRep = `+${phoneRep}`;
    } else {
      phoneRep = `+90${phoneRep}`;
    }

    return new DutyPharmacyModel(
      json.pharmacyID,
      json.pharmacyName,
      json.address,
      json.city,
      json.district,
      json.directions,
      phoneRep,
      json.pharmacyDutyStart,
      json.pharmacyDutyEnd,
      json.latitude,
      json.longitude
    );
  }

  get getLocation() {
    return `${this.latitude}, ${this.longitude}`;
  }
}

module.exports = DutyPharmacyModel;
