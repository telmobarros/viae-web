import { stringify } from 'query-string';
import { fetchUtils, DataProvider } from 'react-admin';

/**
 * Maps react-admin queries to a Flask-App-Builder REST API
 *
 * This REST dialect is similar to the one of FakeRest
 *
 * @see https://github.com/marmelab/FakeRest
 *
 * @example
 *
 * getList     => GET http://my.api.url/posts?sort=['title','ASC']&range=[0, 24]
 * getOne      => GET http://my.api.url/posts/123
 * getMany     => GET http://my.api.url/posts?filter={id:[123,456,789]}
 * update      => PUT http://my.api.url/posts/123
 * create      => POST http://my.api.url/posts
 * delete      => DELETE http://my.api.url/posts/123
 *
 * @example
 *
 * import * as React from "react";
 * import { Admin, Resource } from 'react-admin';
 * import simpleRestProvider from 'ra-data-simple-rest';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={simpleRestProvider('http://path.to.my.api/')}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */
export default (apiUrl: string, httpClient = fetchUtils.fetchJson, countHeader: string = 'Content-Range'): DataProvider => ({
    getList: (resource, params) => {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;

        const rangeStart = (page - 1) * perPage;
        const rangeEnd = page * perPage - 1;

        console.log(params);
        console.log(params.filter);
        // transform a filter object to a filters array with operators
        // filter is like { commentable: true, released_gte: '2018-01-01' }
        const filter = params.filter;
        const operators = ['eq', 'neq', 'ct', 'lt', 'lte', 'gt', 'gte', 'rel_o_m'];
        // filters is like [
        //    { col: "commentable", opr: "eq", value: true},
        //    { col: "released", opr: "gte", value: '2018-01-01'}
        // ]
        const filters = Object.keys(filter).map((key) => {
            const splitIndex = key.lastIndexOf('__');
            const col = key.slice(0, splitIndex); // column name
            const opr = key.slice(splitIndex + 2); // operator name (gte, lte, neq, eq, rel_o_m)

            return operators.includes(opr) ? { col: col, opr: opr, value: filter[key] } : { col: key, opr: 'eq', value: filter[key] };
        });
        console.log(filters);

        const query = {
            //sort: [field, order],
            //range: [rangeStart, rangeEnd],
            page: page - 1,
            page_size: perPage,
            filters: filters
        };
        // Ordering is always forwarded, `id` included.
        //
        // This previously skipped `order_column` whenever the field was `id`,
        // because the API rejects it by default: Flask-AppBuilder derives
        // `order_columns` from `list_columns`, which defaults to
        // get_user_columns_list() — and that *excludes the primary key*. So
        // ordering by id returned 400 "Invalid order by column: id".
        //
        // Skipping it client-side hid the 400 but meant clicking the id header,
        // and the `sort={{ field: 'id' }}` default several List views declare,
        // sent no ordering at all — the server returned its natural order, so
        // ascending looked right and descending silently did nothing.
        //
        // The fix is server-side: each ModelRestApi that should be sortable by
        // id declares `order_columns` explicitly including 'id' (see
        // DatasetInstanceModelApi / DatasetModelApi / DataSourceApi). If you
        // add a resource here, give its API that same explicit `order_columns`
        // rather than reinstating a client-side skip.
        query['order_column'] = field;
        query['order_direction'] = order.toLowerCase();
        const url = `${apiUrl}/${resource}/?q=${encodeURIComponent(JSON.stringify(query))}`;
        const options =
            countHeader === 'Content-Range'
                ? {
                      // Chrome doesn't return `Content-Range` header if no `Range` is provided in the request.
                      headers: new Headers({
                          Range: `${resource}=${rangeStart}-${rangeEnd}`
                      })
                  }
                : {};

        return httpClient(url, options).then(({ headers, json }) => {
            // apend the id to the result if it's not already there (get it from the json['ids'] array)
            if (!json['result'].every((obj) => 'id' in obj)) {
                json['result'] = json['result'].map((item, index) => ({
                    ...item,
                    id: json['ids'][index]
                }));
            }

            return {
                data: json['result'],
                total: json['count']
            };
        });
    },

    getOne: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => {
            // apend the id to the result if it's not already there
            if (!('id' in json['result'])) {
                json['result']['id'] = json['id'];
            }
            return {
                data: json['result']
            };
        }),

    // Fans out to one GET per id rather than issuing a single filtered list
    // call, because Flask-AppBuilder has no "id IN (...)" filter: its operator
    // set is eq/neq/sw/ew/ct/gt/lt/rel_o_m/rel_m_m plus `inf`
    // (FilterInFunction), and `inf` takes a *function*, not a literal list.
    //
    // This previously sent `?filter={"id":[...]}` — the ra-data-simple-rest
    // dialect this provider was forked from, not the FAB one. FAB ignored the
    // unknown `filter` param entirely and returned the first page of the whole
    // collection, and the results were handed back untouched, so react-admin
    // reported "the received data items do not have an 'id' key" (FAB returns
    // ids in a separate top-level `ids` array, which is why getList/getOne
    // both graft the id on explicitly).
    //
    // ReferenceInput calls this to resolve the label of a chosen value, so the
    // id list is normally very short. Fanning out matches how updateMany and
    // deleteMany below already work.
    getMany: (resource, params) =>
        Promise.all(
            params.ids.map((id) =>
                httpClient(`${apiUrl}/${resource}/${id}`).then(({ json }) => {
                    const record = json['result'];
                    if (record && !('id' in record)) {
                        record['id'] = 'id' in json ? json['id'] : id;
                    }
                    return record;
                })
            )
        ).then((records) => ({ data: records.filter((record) => record != null) })),

    getManyReference: (resource, params) => {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;

        const rangeStart = (page - 1) * perPage;
        const rangeEnd = page * perPage - 1;

        const query = {
            sort: JSON.stringify([field, order]),
            range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
            filter: JSON.stringify({
                ...params.filter,
                [params.target]: params.id
            })
        };
        const url = `${apiUrl}/${resource}?${stringify(query)}`;
        const options =
            countHeader === 'Content-Range'
                ? {
                      // Chrome doesn't return `Content-Range` header if no `Range` is provided in the request.
                      headers: new Headers({
                          Range: `${resource}=${rangeStart}-${rangeEnd}`
                      })
                  }
                : {};

        return httpClient(url, options).then(({ headers, json }) => {
            return {
                data: json['result'],
                total: json['count']
            };
        });
    },

    update: (resource, params) => {
        delete params.data.id; // remove the id from the data, as it's not needed
        return httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'PUT',
            body: JSON.stringify(params.data)
        }).then(({ json }) => {
            // if id not in the response, we assume the id is the same as the one in the request
            if (!('id' in json)) {
                json['id'] = params.id;
            }
            return { data: json };
        });
    },

    // simple-rest doesn't handle provide an updateMany route, so we fallback to calling update n times instead
    updateMany: (resource, params) =>
        Promise.all(
            params.ids.map((id) =>
                httpClient(`${apiUrl}/${resource}/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(params.data)
                })
            )
        ).then((responses) => ({ data: responses.map(({ json }) => json.id) })),

    create: (resource, params) =>
        httpClient(`${apiUrl}/${resource}`, {
            method: 'POST',
            body: JSON.stringify(params.data)
        }).then(({ json }) => ({ data: json })),

    delete: (resource, params) =>
        httpClient(`${apiUrl}/${resource}/${params.id}`, {
            method: 'DELETE',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        }).then(({ json }) => ({ data: json })),

    // simple-rest doesn't handle filters on DELETE route, so we fallback to calling DELETE n times instead
    deleteMany: (resource, params) =>
        Promise.all(
            params.ids.map((id) =>
                httpClient(`${apiUrl}/${resource}/${id}`, {
                    method: 'DELETE',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                })
            )
        ).then((responses) => ({
            data: responses.map(({ json }) => json.id)
        }))
});
