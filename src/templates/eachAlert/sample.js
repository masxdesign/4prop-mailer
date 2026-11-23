/**
 * Sample data for the Admin > Emails preview: the shape db-sync sends for one agent
 * (send-EACHAlertDaily.js `getEmailTemplateVariables`). Values are made up but in
 * db-sync's own formats: item hrefs are complete, labels and locations are already
 * cleaned (`<br/>`, the grey <small> district), a requirement's logo is a URL or null.
 */

const HOST = 'https://www.4prop.com'
const HASH = '0a1b2c3d'
const SINCE = '261020'

const propertyHref = (key) => `${HOST}/each-alert/${HASH}/p?since=${SINCE}&scrollkey=${key}&view=Line&marketing=AP1`
const requirementHref = (rid) => `${HOST}/requirement/${rid}?alert=${HASH}&since=${SINCE}&marketing=AR1`

export const eachAlertSample = {
    prop_com: HOST,
    hash: HASH,
    since: SINCE,
    nid: '123456',
    name: 'John',
    property_count: 14,
    requirement_count: 3,
    properties: [
        { pc: 'W1', label: 'Mayfair', href: propertyHref('mayfair_1') },
        { pc: 'EC2', label: 'City of London', href: propertyHref('city_of_london_2') },
        { pc: 'N1', label: 'Islington', href: propertyHref('islington_3') },
        { pc: 'SE1', label: 'Southwark', href: propertyHref('southwark_4') },
    ],
    requirements: [
        {
            href: requirementHref(901234),
            types: 'Offices, Serviced offices',
            locationHtml: 'London<small style="color:#ababab;margin-left:3px;margin-right:6px">EC1, EC2</small>',
            size: '2,000 - 5,000 sq ft',
            logo: 'https://www.4prop.com/JSON/NIDs/DIDs/2826/260313123812/2.png',
            companyName: 'Example Agents',
        },
        {
            href: requirementHref(901235),
            types: 'Shops, Restaurants',
            locationHtml: 'Camden<small style="color:#ababab;margin-left:3px;margin-right:6px">NW1</small>',
            size: '800 - 1,500 sq ft',
            logo: null,
            companyName: 'Retail Search Partners',
        },
    ],
}
