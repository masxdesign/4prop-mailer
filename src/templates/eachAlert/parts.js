/**
 * EACH alert email (sent daily by db-sync), split into parts.
 *
 * Each part is a Handlebars string in the subset AWS SES renders: {{var}}, {{#if}}{{else}},
 * {{#each}}. SES does NOT support partials ({{> name}}), so `composeEachAlertTemplate()`
 * (./index.js) inlines the parts into the wrapper before db-sync uploads the result as
 * one SES template. SES does not HTML-escape {{var}} either, which the data relies on
 * (item labels and locations carry <br/> and <small> markup): the local renderer is
 * compiled with `noEscape` to match.
 *
 * Inside {{#each}} the context is the item, so items carry everything they print
 * (their own href); nothing reaches for the outer data with ../
 *
 * Links go straight to the app's pages (/each-alert?hash=, /requirements?scope=each-alert,
 * /requirements/<rid>?hash=), not the legacy /each-alert/<hash>/p|r and /requirement/<rid>
 * addresses 4prop 301s there (Controller\EACHAlertPage). The old marketing=AP0/AP2/AR0
 * tags went with them: the redirect dropped them anyway.
 *
 * The markup is today's email (db-sync src/templates/email/awsEmailTemplates/EACHAlert.html,
 * identical to the live SES template "EACHAlert" on 2026-11-23) plus the bits db-sync used
 * to build as HTML strings: the <style> block, one property row and one requirement row.
 * The CRM button three admin agents used to get in the header was removed on 2026-11-23.
 *
 * Data (see ./sample.js):
 *   prop_com, hash, since, nid, name, property_count, requirement_count,
 *   properties:   [{ pc, label, href }]
 *   requirements: [{ href, types, locationHtml, size, logo, companyName }]
 */

export const subject = 'EACH Alert [Daily] from Estate Agents Clearing House est 1984'

/** Top bar: "view in a browser" and the EACH logo strip. */
export const header = `<tr>
                        <td style="text-align:center;">
                            <a href="{{prop_com}}/each-alert" style="font-size: 12px;margin-bottom: 8px;" target="_blank">view in a browser</a>
                            <div style="line-height:0;background:url({{prop_com}}/new/images/alert-grad-x2.png) repeat-x;width:661px;height:60px;text-align: left;padding:10px">
                                <table cellpadding="0" width="100%" style="border-collapse: collapse">
                                    <tbody>
                                        <tr>
                                            <td>
                                                <img src="http://www.each.co.uk/JSON/EACH/files/now/each.co.uk/img/f/l.png" style="display:inline-block;height:60px;margin-right: 10px;" />
                                                <span style="font-size: 12px;color: white;">Estate Agents Clearing House</span>
                                            </td>
                                            <td style="text-align: right; padding: 0 15px">
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>`

/** Statistics link, greeting and the "update your filters" line. */
export const intro = `<p style="text-align: center">
                                <a href="{{prop_com}}/props/clicks?scope=company&sort=site&days=28">click here to see your Statistics</a>
                            </p>
                            <p>
                                Dear {{name}}
                            </p>
                            <p>
                                Agents new Properties & Requirements of your day to day interest.
                                <br />
                                <a href="https://www.each.co.uk/?alert{{hash}}*s" target="_blank">
                                    Not exactly what you want? update Types/Locations/Filters here
                                </a>
                                <br />
                                or call 020 7602 5947.
                                <br />
                                <br />
                                <br />
                            </p>`

/** One town / suburb in the properties column. Repeated per item in `properties`. */
export const propertyItem = `
                <div style="margin-bottom:12px">
                    <span style="margin-right:5px;font-size:12px;color:#999;width:20px;display:inline-block;white-space: nowrap">{{pc}}</span>
                    <a href="{{href}}" style="font-size:23px;white-space: nowrap">
                        {{label}}
                    </a>
                </div>
            `

/** One requirement row in the requirements column. Repeated per item in `requirements`. */
export const requirementItem = `
                <tr valign="top" style="color:#444">
                    <td style="padding-left:15px">
                        <a href="{{href}}" style="white-space:nowrap;display:block;overflow:hidden">{{types}}</a>
                        <span style="white-space:nowrap;display:block;margin-bottom:2.4em">
                            <span style="display:block;color:#444">{{locationHtml}}</span>
                            <span style="display:block">{{size}}</span>
                        </span>
                    </td>
                    <td style="padding-top:7px;padding-left:15px">
                        {{#if logo}}<img src="{{logo}}" width="50" alt="{{companyName}}" title="{{companyName}}" />{{else}}{{companyName}}{{/if}}
                    </td>
                </tr>
            `

/** EACH's pitch and address, then the open-tracking pixel. */
export const footer = `<p style="text-align: center;">
                                <b style="display: block; margin-bottom: 2em;">
                                    REACH ALL RELEVANT UK AGENTS WITH EACH
                                    <small style="color: #999;display: block;">
                                        Data Feeds in/out of EACH take none of your staff time - ask us
                                    </small>
                                </b>
                                <small style="font-size: 10px;line-height: 1.5em;">
                                    Estate Agents Clearing House Ltd, 3 Beaconsfield Terrace Road, London, W14 0PP
                                    <span style="display: block;">
                                        020 7602 5947, <a href="http://www.each.co.uk" target="_blank">www.each.co.uk</a>,
                                        <a href="mailto:info@each.co.uk" target="_blank">info@each.co.uk</a>
                                    </span>
                                </small>
                            </p>`

/**
 * The page around the parts. {{> name}} marks where a part goes (inlined by
 * composeEachAlertTemplate, not by Handlebars).
 */
export const wrapper = `<!doctype html>
<html>
    <head>

        <style type="text/css">
            a { text-decoration: none }
            a:hover { text-decoration: underline }
        </style>

    </head>
    <body>
        <div style="font-size:20px;padding-bottom:20px;font-family: Arial">
            <table style="width: 661px;margin:0 auto;">
                <tbody>
                    {{> header}}
                    <tr>
                        <td style="color: #444; line-height: 1.5em; width: 580px;padding:15px;background-color: #fff;">
                            {{> intro}}
                            <table style="margin-bottom: 50px; width:629px">
                                <tbody>
                                    <tr valign="top">
                                        <td style="border-right: 1px dotted #e78500;width: 314px;">
                                            <h3 style="margin-top:0;font-weight: normal;text-align:center;margin-bottom: 0;display:block;width:314px">
                                                <a href="{{prop_com}}/each-alert?hash={{hash}}&since={{since}}&view=grid" target="_blank">
                                                    {{property_count}} new Properties
                                                </a>
                                            </h3>
                                            <div style="color: #92b0e5;margin-bottom: 24px;text-align:center">in grid view</div>
                                            {{#each properties}}{{> propertyItem}}{{/each}}{{#if properties}}
            <a href="{{prop_com}}/each-alert?hash={{hash}}&since={{since}}&view=map">or see all {{property_count}} in map view</a>
        {{/if}}
                                        </td>
                                        <td style="width: 314px;">
                                            <h3 style="margin-top:0;margin-left:15px;font-weight: normal;text-align:center;margin-bottom: 0;display:block;width:314px">
                                                <a href="{{prop_com}}/requirements?scope=each-alert&hash={{hash}}&since={{since}}" target="_blank">
                                                    {{requirement_count}} new Requirements
                                                </a>
                                            </h3>
                                            <div style="color: #92b0e5;margin-bottom: 24px;text-align:center">in line view</div>
                                            <table>
                                                <tbody>
                                                    {{#each requirements}}{{> requirementItem}}{{/each}}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            {{> footer}}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <img src='https://api.4prop.com/optr/a/{{nid}}_{{since}}/0.gif' />
    </body>
</html>`

/** The editable parts, in reading order (for the admin preview's part list). */
export const PARTS = { wrapper, header, intro, propertyItem, requirementItem, footer }
