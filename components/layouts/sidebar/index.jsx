'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Links from './links';
import './styles/index.scss';
import ToggleButton from './toggleButton';

const sidebarVariants = {
  open: {
    clipPath: 'circle(1200px at 50px 50px)',
    transition: { type: 'spring', stiffness: 20 },
  },
  closed: {
    clipPath: 'circle(0px at 50px 50px)',
    transition: { delay: 0.5, type: 'spring', stiffness: 400, damping: 40 },
  },
};

function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div className="sidebar" animate={open ? 'open' : 'closed'}>
      <motion.div
        id="sidebar-menu"
        className="bg"
        variants={sidebarVariants}
        aria-hidden={!open}
      >
        <Links setOpen={setOpen} />
      </motion.div>
      <ToggleButton setOpen={setOpen} open={open} />
    </motion.div>
  );
}

export default Sidebar;
