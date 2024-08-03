class DutyPharmacyModel {
  constructor(
    id,
    name,
    address,
    city,
    district,
    directions,
    phone,
    pharmacyDutyStart,
    pharmacyDutyEnd,
    latitude,
    longitude
  ) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.city = city;
    this.district = district;
    this.directions = directions;
    this.phone = phone;
    this.pharmacyDutyStart = pharmacyDutyStart;
    this.pharmacyDutyEnd = pharmacyDutyEnd;
    this.latitude = latitude;
    this.longitude = longitude;
  }

  static fromJson(json) {
    return new DutyPharmacyModel(
      json.pharmacyId,
      json.pharmacyName,
      json.address,
      json.city,
      json.district,
      json.directions,
      json.phone,
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
