import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  CheckCircle2,
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  RefreshCw,
  ShieldCheck,
  Building
} from 'lucide-react';
import { labApi } from '../services/api';
import { LabTestPackage, LabBooking, UserProfile } from '../types';

interface Props {
  onBack: () => void;
  userProfile?: UserProfile | null;
}

export const LabBookingScreen: React.FC<Props> = ({ onBack, userProfile }) => {
  const [packages, setPackages] = useState<LabTestPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<LabTestPackage | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [patientName, setPatientName] = useState(userProfile?.name || '');
  const [patientPhone, setPatientPhone] = useState('+91 98765 43210');
  const [collectionAddress, setCollectionAddress] = useState(
    'B-402, Green Glen Heights, Bellandur, Bengaluru, 560103'
  );
  const [collectionDate, setCollectionDate] = useState('2026-09-09');
  const [collectionSlot, setCollectionSlot] = useState('07:30 AM - 08:30 AM');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<LabBooking | null>(null);

  useEffect(() => {
    loadPackages();
    if (userProfile?.name && !patientName) {
      setPatientName(userProfile.name);
    }
  }, [userProfile]);

  const loadPackages = async () => {
    try {
      const res = await labApi.listPackages();
      setPackages(res.packages);
    } catch (e) {
      console.warn('Failed to fetch packages', e);
    }
  };

  const handleBook = async () => {
    if (!selectedPackage || !selectedPartner) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      const res = await labApi.book({
        packageId: selectedPackage.id,
        patientName: patientName || userProfile?.name || 'Patient',
        patientPhone: patientPhone || '+91 98765 43210',
        patientAddress: collectionAddress,
        bookingType: 'home_collection',
        slotDate: collectionDate,
        slotTime: collectionSlot
      });
      setConfirmedBooking(res.booking);
    } catch (e: any) {
      setBookingError(e.message || 'Lab booking failed. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full font-bold border border-teal-200">
          <FlaskConical className="h-3.5 w-3.5" />
          <span>NABL Accredited Diagnostics</span>
        </div>
      </div>

      {confirmedBooking ? (
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-6 shadow-xs text-center space-y-4 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D]">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
              Sample Collection Scheduled
            </span>
            <h1 className="text-xl font-black text-[#1F2421] mt-2">
              {confirmedBooking.packageName}
            </h1>
            <p className="text-xs text-gray-600">Partner Lab: {confirmedBooking.partner}</p>
          </div>

          <div className="rounded-2xl bg-[#F8F7F2] p-4 text-xs space-y-2 text-left border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500">Date & Slot:</span>
              <span className="font-bold text-gray-900">
                {confirmedBooking.collectionDate} ({confirmedBooking.collectionSlot})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Address:</span>
              <span className="font-semibold text-gray-800 text-right max-w-[200px] truncate">
                {confirmedBooking.collectionAddress}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Booking ID:</span>
              <span className="font-mono text-gray-700">{confirmedBooking.id}</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            A phlebotomist will arrive with a sterile kit. Results typically delivered digitally in 24 hours.
          </p>

          <button
            onClick={onBack}
            className="w-full rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
          >
            Return to Dashboard
          </button>
        </div>
      ) : selectedPackage ? (
        /* BOOKING FORM */
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-start justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-500">Lab Diagnostic Booking</span>
              <h2 className="text-base font-bold text-gray-900">{selectedPackage.name}</h2>
              <p className="text-xs text-gray-500">{selectedPackage.description}</p>
            </div>
            <button
              onClick={() => setSelectedPackage(null)}
              className="text-xs text-gray-500 hover:text-gray-900 underline"
            >
              Change
            </button>
          </div>

          {/* Select Accredited Partner */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Select Accredited Partner Lab</label>
            <div className="mt-1.5 space-y-2">
              {selectedPackage.partnerOptions.map(partner => (
                <button
                  key={partner}
                  type="button"
                  onClick={() => setSelectedPartner(partner)}
                  className={`flex w-full items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all ${
                    selectedPartner === partner
                      ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534]'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span>{partner}</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">Home Phlebotomy</span>
                </button>
              ))}
            </div>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-gray-700">Patient Full Name</label>
              <input
                type="text"
                value={patientName}
                placeholder="Full Name"
                onChange={e => setPatientName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={patientPhone}
                placeholder="+91 Mobile"
                onChange={e => setPatientPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Home Address */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Sample Collection Address</label>
            <textarea
              rows={2}
              value={collectionAddress}
              onChange={e => setCollectionAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
              required
            />
          </div>

          {/* Date & Slot */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-gray-700">Date</label>
              <input
                type="date"
                value={collectionDate}
                onChange={e => setCollectionDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Time Slot</label>
              <select
                value={collectionSlot}
                onChange={e => setCollectionSlot(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
              >
                <option value="06:30 AM - 07:30 AM">06:30 AM - 07:30 AM (Fasting)</option>
                <option value="07:30 AM - 08:30 AM">07:30 AM - 08:30 AM (Fasting)</option>
                <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM</option>
                <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-gray-500">Package Total</span>
              <span className="text-base font-black text-gray-900">
                ₹{selectedPackage.priceInr}
              </span>
            </div>

            {bookingError && (
              <div className="mb-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {bookingError}
              </div>
            )}

            <button
              disabled={!selectedPartner || isBooking}
              onClick={handleBook}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 text-xs font-bold text-white shadow hover:bg-[#166534] disabled:opacity-50"
            >
              {isBooking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Dispatching Home Collector Request...</span>
                </>
              ) : (
                <span>Confirm Lab Collection</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* CATALOG VIEW */
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
            <h1 className="text-xl font-extrabold text-[#1F2421]">Home Diagnostic Packages</h1>
            <p className="mt-1 text-xs text-[#5C645D]">
              NABL accredited diagnostic blood tests and cardiac screenings with doorstep phlebotomy.
            </p>
          </div>

          <div className="space-y-3">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className="rounded-3xl border border-[#EAE7DE] bg-white p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">{pkg.name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-base font-black text-gray-900">₹{pkg.priceInr}</span>
                    <span className="text-[10px] text-gray-500 block">Home sample incl.</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#FAF9F6] p-2.5 text-xs text-gray-700 border border-gray-100">
                  <span className="font-semibold text-gray-900">Parameters checked:</span>{' '}
                  {pkg.parametersIncluded.join(' • ')}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs">
                  <span className="text-[11px] text-gray-500">
                    Fasting: {pkg.fastingRequired ? '10–12 hrs required' : 'No fasting'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setSelectedPartner(pkg.partnerOptions[0] || 'Thyrocare');
                    }}
                    className="rounded-xl bg-[#15803D] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#166534]"
                  >
                    Select & Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
