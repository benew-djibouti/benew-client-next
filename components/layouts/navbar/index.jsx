'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRef, useState, useEffect, useCallback } from 'react';
import './index.scss';
import Sidebar from '../sidebar';
import Image from 'next/image';
import { MdKeyboardArrowDown } from 'react-icons/md';

// En dehors du composant
const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    href: process.env.NEXT_PUBLIC_FACEBOOK_URL || '#',
    icon: '/facebook.png',
    alt: 'Facebook logo',
  },
  {
    name: 'Instagram',
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '#',
    icon: '/instagram.png',
    alt: 'Instagram logo',
  },
  {
    name: 'TikTok',
    href: process.env.NEXT_PUBLIC_TIKTOK_URL || '#',
    icon: '/tik-tok.png',
    alt: 'TikTok logo',
  },
];

function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const buttonRef = useRef(null);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, closeDropdown]);

  return (
    <div className="navbar">
      {/* Sidebar */}
      <Sidebar />

      <div className="wrapper">
        {/* Structure pour moyens et grands écrans */}
        <div className="desktop-structure">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/">
              <Image
                priority={true}
                src="/icon-32x32.png"
                height={48}
                width={60}
                alt="BuyItNow"
                className="logo"
                unoptimized
              />
            </Link>
          </motion.div>

          <div className="social">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src={social.icon}
                  alt={social.alt}
                  width={24}
                  height={24}
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>

        {/* Structure pour petits écrans */}
        <div className="mobile-structure">
          <motion.div
            className="mobile-logo"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/">
              <Image
                priority={true}
                src="/logo.png"
                height={48}
                width={60}
                alt="BuyItNow"
                className="logo"
                unoptimized
              />
            </Link>
          </motion.div>

          {/* Bouton Audio Player Mobile - NOUVEAU */}

          <div className="mobile-social-container">
            <button
              ref={buttonRef}
              type="button"
              className="social-dropdown-trigger"
              onClick={toggleDropdown}
              aria-label={
                isDropdownOpen
                  ? 'Fermer le menu des réseaux sociaux'
                  : 'Ouvrir le menu des réseaux sociaux'
              }
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              aria-controls="social-dropdown-menu"
            >
              <Image
                src="/social_websites.png"
                alt="Réseaux sociaux"
                width={24}
                height={24}
                className="social-websites-icon"
                unoptimized
              />
              {/* REMPLACER le SVG par cette icône React */}
              <MdKeyboardArrowDown
                className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
              />
            </button>
            {isDropdownOpen && (
              <div className="social-dropdown">
                <div className="dropdown-backdrop" onClick={closeDropdown} />
                <div id="social-dropdown-menu" className="dropdown-content">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      onClick={closeDropdown}
                    >
                      <Image
                        src={social.icon}
                        alt={social.alt}
                        width={20}
                        height={20}
                        unoptimized
                      />
                      <span>{social.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
