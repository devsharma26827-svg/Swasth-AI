import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Star,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { doctorApi } from '../services/api';
import { Doctor, Appointment } from '../types';

interface Props {
  onBack: () => void;
}

export const DoctorConsultScreen: React.FC<Props> = ({ onBack }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-08');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [consultType, setConsultType] = useState<'video' | 'in_person'>('video');
  const [notes, setNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadDoctors();
  }, [selectedSpecialty]);

  const loadDoctors = async () => {
    try {
      const res = await doctorApi.list(selectedSpecialty);
      setDoctors(res.doctors);
    } catch (e) {
      console.warn('Failed to fetch doctors', e);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedSlot) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      const res = await doctorApi.bookAppointment({
        doctorId: selectedDoctor.id,
        date: selectedDate,
        timeSlot: selectedSlot,
        consultType,
        notes
      });
      setConfirmedAppointment(res.appointment);
    } catch (e: any) {
      setBookingError(e.message || 'Booking failed. Please check connection and retry.');
    } finally {
      setIsBooking(false);
    }
  };

  const specialties = ['all', 'General Physician', 'Cardiologist', 'Pulmonologist'];

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
        <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-bold border border-blue-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Telehealth Consultation</span>
        </div>
      </div>

      {/* CONFIRMATION VIEW */}
      {confirmedAppointment ? (
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-6 shadow-xs text-center space-y-4 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D]">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
              Appointment Confirmed
            </span>
            <h1 className="text-xl font-black text-[#1F2421] mt-2">
              {confirmedAppointment.doctorName}
            </h1>
            <p className="text-xs text-gray-600">{confirmedAppointment.specialty}</p>
          </div>

          <div className="rounded-2xl bg-[#F8F7F2] p-4 text-xs space-y-2 text-left border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500">Date & Slot:</span>
              <span className="font-bold text-gray-900">
                {confirmedAppointment.date} at {confirmedAppointment.timeSlot}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Mode:</span>
              <span className="font-bold text-gray-900 capitalize">
                {confirmedAppointment.consultType.replace('_', ' ')} Consultation
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Booking Reference:</span>
              <span className="font-mono text-gray-700">{confirmedAppointment.id}</span>
            </div>
            {confirmedAppointment.notes && (
              <div className="border-t border-gray-200 pt-2 text-gray-600">
                <span className="font-semibold text-gray-800">Patient Note:</span>{' '}
                {confirmedAppointment.notes}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-500">
            A secure video consult link will be shared 15 minutes prior to the appointment.
          </p>

          <button
            onClick={onBack}
            className="w-full rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow hover:bg-[#166534]"
          >
            Return to Dashboard
          </button>
        </div>
      ) : selectedDoctor ? (
        /* BOOKING FORM MODAL/VIEW */
        <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-start justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-gray-500">Consultation Booking</span>
              <h2 className="text-base font-bold text-gray-900">{selectedDoctor.name}</h2>
              <p className="text-xs text-gray-500">{selectedDoctor.specialty} • {selectedDoctor.experienceYears} yrs exp</p>
            </div>
            <button
              onClick={() => setSelectedDoctor(null)}
              className="text-xs text-gray-500 hover:text-gray-900 underline"
            >
              Change Doctor
            </button>
          </div>

          {/* Consultation Type */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Consultation Medium</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConsultType('video')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all ${
                  consultType === 'video'
                    ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534]'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <Video className="h-4 w-4" />
                <span>Video Call</span>
              </button>
              <button
                type="button"
                onClick={() => setConsultType('in_person')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all ${
                  consultType === 'in_person'
                    ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534]'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <MapPin className="h-4 w-4" />
                <span>In-Clinic Visit</span>
              </button>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
            />
          </div>

          {/* Time Slots */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Available Slots</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {selectedDoctor.slots.map((slot, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all ${
                    selectedSlot === slot
                      ? 'border-[#15803D] bg-[#15803D] text-white shadow-2xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-700">Clinical Query / Symptoms (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Discussing elevated resting HR trend and follow-up screening signals."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 font-medium focus:border-[#15803D] focus:outline-hidden"
            />
          </div>

          {/* Fee & Confirm */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-gray-500">Consultation Fee</span>
              <span className="text-base font-black text-gray-900">
                ₹{selectedDoctor.consultationFeeInr}
              </span>
            </div>

            {bookingError && (
              <div className="mb-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {bookingError}
              </div>
            )}

            <button
              disabled={!selectedSlot || isBooking}
              onClick={handleBookAppointment}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3.5 text-xs font-bold text-white shadow hover:bg-[#166534] disabled:opacity-50"
            >
              {isBooking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Scheduling Appointment...</span>
                </>
              ) : (
                <span>Confirm Appointment</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* DOCTOR CATALOG LIST */
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
            <h1 className="text-xl font-extrabold text-[#1F2421]">Verified Doctor Consult</h1>
            <p className="mt-1 text-xs text-[#5C645D]">
              Connect with experienced specialists to evaluate screening trends and receive clinical advice.
            </p>

            {/* Specialty Pills */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {specialties.map(sp => (
                <button
                  key={sp}
                  onClick={() => setSelectedSpecialty(sp)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize whitespace-nowrap transition-all border ${
                    selectedSpecialty === sp
                      ? 'bg-[#15803D] text-white border-[#15803D]'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {sp === 'all' ? 'All Specialists' : sp}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Cards */}
          <div className="space-y-3">
            {doctors.map(doc => (
              <div
                key={doc.id}
                className="rounded-3xl border border-[#EAE7DE] bg-white p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F5E9] text-sm font-black text-[#15803D]">
                      {doc.avatarInitials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900">{doc.name}</h2>
                        {doc.isDemo && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                            DEMO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">{doc.degree}</p>
                      <span className="text-[11px] font-bold text-[#15803D] block mt-0.5">
                        {doc.specialty} • {doc.experienceYears} yrs experience
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    <span>{doc.rating}</span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>{doc.hospital}</span>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                  <div>
                    <span className="text-[10px] text-gray-500">Consultation Fee</span>
                    <div className="text-sm font-black text-gray-900">₹{doc.consultationFeeInr}</div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDoctor(doc);
                      setSelectedSlot(doc.slots[0] || '10:00 AM');
                    }}
                    className="rounded-xl bg-[#15803D] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#166534] transition-all"
                  >
                    Select Slot & Consult
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
