import React, { useState } from 'react';
import { Plus, Shield, Trash2, X } from 'lucide-react';
import type { EmergencyContact } from '../../types/models';
import { BackHeader } from '../layout/BackHeader';

interface ContactFormProps {
  close: () => void;
  add: (contact: Partial<EmergencyContact>) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ close, add }) => {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setFormError('Add an email address or phone number so this contact can confirm.');
      return;
    }
    add({
      name,
      relation,
      email,
      phone,
      confirmationStatus: 'pending',
    });
  };

  return (
    <div className="modal-backdrop">
      <form className="sheet contact-form" onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <h2>Add Emergency Contact</h2>
          <button type="button" onClick={close} aria-label="Close form">
            <X />
          </button>
        </div>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full name"
          />
        </label>
        <label>
          Relationship
          <input
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            required
            placeholder="e.g. Sister, Friend"
          />
        </label>
        <label>
          Email address <small>Preferred for confirmation</small>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="name@example.com"
          />
        </label>
        <label>
          Phone number <small>Use international format</small>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="e.g. +919876543210"
          />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <p className="contact-consent">
          🔒 We'll send one confirmation link now. This contact cannot receive SOS alerts until they confirm.
        </p>
        <button className="primary" type="submit">
          Add contact
        </button>
      </form>
    </div>
  );
};

interface ContactsScreenProps {
  nav: (page: string) => void;
  contacts: EmergencyContact[];
  addContact: (contact: Partial<EmergencyContact>) => void;
  removeContact: (id: string | number) => void;
}

export const ContactsScreen: React.FC<ContactsScreenProps> = ({
  nav,
  contacts,
  addContact,
  removeContact,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <section className="screen contacts-screen">
      <BackHeader
        title="Emergency contacts"
        nav={nav}
        extra={
          <button className="round-add" onClick={() => setShowAddForm(true)} aria-label="Add contact">
            <Plus />
          </button>
        }
      />
      <div className="contacts-info">
        <span>
          <Shield size={23} />
        </span>
        <div>
          <b>People who have your back</b>
          <p>
            Each contact receives your emergency SOS and live-location alerts when triggered.
          </p>
        </div>
      </div>

      <div className="contact-list">
        {contacts.map((contact) => (
          <div className="contact-row full" key={contact.id}>
            <span style={{ background: contact.color }}>{contact.initials}</span>
            <div>
              <b>{contact.name}</b>
              <small>
                {contact.relation}
                {contact.confirmationStatus === 'pending' ? ' · Confirmation pending' : ''}
              </small>
            </div>
            <button
              onClick={() => removeContact(contact.id)}
              aria-label={`Remove ${contact.name}`}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>

      <button className="add-contact" onClick={() => setShowAddForm(true)}>
        <Plus size={19} /> Add emergency contact
      </button>

      {showAddForm && (
        <ContactForm
          close={() => setShowAddForm(false)}
          add={(c) => {
            addContact(c);
            setShowAddForm(false);
          }}
        />
      )}
    </section>
  );
};
