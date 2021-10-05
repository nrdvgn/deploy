/*
- Delete accounts
- Unblock accounts
*/
const GRANT   = 0x10;

/*
- Update roles
- Delete any articles
- Update quarantine status
*/
const SYSTEM  = 0x08;

/*
- Update any articles
- Allow articles
*/
const CHANGE  = 0x04;

/*
- Create articles
- Update own articles
*/
const WRITE   = 0x02;


const NOTHING = 0x00;

/*

LOGIC CONSTANTS

root has permissions                    >= GRANT  and Boolean((admin     << 1)&GRANT)  === true
admin has permissions     < GRANT   and >= SYSTEM and Boolean((moderator << 1)&SYSTEM) === true
moderator has permissions < SYSTEM  and >= CHANGE and Boolean((operator  << 1)&CHANGE) === true
operator has permissions  < CHANGE  and >= WRITE  and Boolean((user      << 1)&WRITE)  === false
user has permissions      < WRITE   and == 0

*/


const RolesEnum = Object.freeze({
    root:      GRANT|SYSTEM|CHANGE|WRITE,
    admin:           SYSTEM|CHANGE|WRITE,
    moderator:              CHANGE|WRITE,
    operator:                      WRITE,

    user:      NOTHING
});


const AccountStatusesEnum = Object.freeze({
    quarantine: 0x01,
    block:      0x02,
    restored:   0x04,
    garbage:    0xff
});



module.exports = {
    Roles: RolesEnum,
    Statuses: AccountStatusesEnum,
    Permissons: Object.freeze({GRANT: GRANT, SYSTEM: SYSTEM, CHANGE: CHANGE, WRITE: WRITE, NOTHING: NOTHING})
}
